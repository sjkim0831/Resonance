#!/usr/bin/env python3
"""Scoped parallel candidates and optimistic integration gate (stdlib only)."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import time


def safe(value):
    p = PurePosixPath(value)
    if not value or p.is_absolute() or any(x in ('', '.', '..') for x in value.split('/')) or '\\' in value:
        raise ValueError('unsafe relative path: ' + value)
    if any(x in ('.git', '.secrets') for x in p.parts):
        raise ValueError('protected path: ' + value)
    return value


def within(path, scope):
    return path == scope or path.startswith(scope + '/')


def overlap(a, b):
    return within(a, b) or within(b, a)


def load_plan(path):
    plan = json.loads(Path(path).read_text())
    tasks = plan['tasks']
    if not tasks or len({t['id'] for t in tasks}) != len(tasks):
        raise ValueError('empty tasks or duplicate IDs')
    if not 1 <= plan.get('workers', 4) <= 32:
        raise ValueError('workers must be 1..32')
    for t in tasks:
        if not re.fullmatch('[a-zA-Z0-9_-]+', t['id']):
            raise ValueError('invalid task ID')
        if not t.get('writes'):
            raise ValueError('each task needs writes')
        for p in t.get('reads', []) + t['writes']:
            safe(p)
        for c in t.get('checks', []):
            command(c)
    for c in plan.get('integration_checks', []):
        command(c)
    # A writer/read dependency requires a separate round with a fresh baseline.
    for i, a in enumerate(tasks):
        for b in tasks[i + 1:]:
            pairs = [(x, y) for x in a['writes'] for y in b['writes'] + b.get('reads', [])]
            pairs += [(x, y) for x in a.get('reads', []) for y in b['writes']]
            if any(overlap(x, y) for x, y in pairs):
                raise ValueError('scope conflict: ' + a['id'] + ' / ' + b['id'])
    return plan


def command(c):
    if not isinstance(c, list) or not c or not all(isinstance(v, str) and v for v in c):
        raise ValueError('checks must be nonempty argv arrays')


def inventory(root, scopes=None):
    root = Path(root).resolve()
    paths = {}
    for scope in scopes if scopes is not None else ['']:
        if scope:
            safe(scope)
        p = root / scope
        # Reject links including intermediate path components, even links inside root.
        cursor = root
        for part in Path(scope).parts:
            cursor /= part
            if cursor.is_symlink():
                raise ValueError('symlink not allowed: ' + str(cursor))
        items = [p]
        while items:
            item = items.pop()
            if item.is_symlink():
                raise ValueError('symlink not allowed: ' + str(item))
            if item.is_dir():
                items.extend(item.iterdir())
            elif item.is_file():
                rel = item.relative_to(root).as_posix()
                safe(rel)
                stat = item.stat()
                paths[rel] = {'sha256': hashlib.sha256(item.read_bytes()).hexdigest(),
                              'mode': stat.st_mode & 0o777, 'bytes': stat.st_size}
            elif item.exists():
                raise ValueError('special file: ' + str(item))
    return dict(sorted(paths.items()))


def save(path, data):
    path = Path(path)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    os.replace(temp, path)


def copy_files(source, target, files):
    for rel in files:
        dest = Path(target) / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(Path(source) / rel, dest)


def scopes_of(plan):
    return sorted({p for t in plan['tasks'] for p in t['writes'] + t.get('reads', [])})


def prepare(root, plan_path, run):
    plan = load_plan(plan_path)
    root, run = Path(root).resolve(), Path(run).resolve()
    for scope in scopes_of(plan):
        if run == root / scope or (root / scope) in run.parents or run in (root / scope).parents:
            raise ValueError('run directory overlaps source scope')
    baseline = inventory(root, scopes_of(plan))
    size = sum(v['bytes'] for v in baseline.values()) * (len(plan['tasks']) + 2)
    run.parent.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(run.parent).free < size + 16 * 1024 * 1024:
        raise ValueError('insufficient candidate space')
    run.mkdir()  # Atomic claim: never reuse an old run.
    copy_files(root, run / 'base', baseline)
    (run / 'base').mkdir(exist_ok=True)
    if inventory(run / 'base') != baseline or inventory(root, scopes_of(plan)) != baseline:
        raise ValueError('source changed during snapshot; prepare a new run')
    for t in plan['tasks']:
        target = run / 'tasks' / t['id']
        target.mkdir(parents=True)
        copy_files(run / 'base', target, baseline)
    save(run / 'manifest.json', {'root': str(root), 'plan': plan, 'baseline': baseline,
                               'created': time.time(), 'reserved_bytes_estimate': size})
    return {'status': 'PREPARED', 'run': str(run), 'files': len(baseline), 'estimated_bytes': size}


def changes(before, after):
    return sorted(p for p in before.keys() | after.keys() if before.get(p) != after.get(p))


def check_commands(commands, cwd, logs, timeout):
    result = []
    logs.mkdir(parents=True, exist_ok=True)
    for i, argv in enumerate(commands):
        started = time.monotonic()
        with (logs / (str(i) + '.log')).open('wb') as out:
            proc = subprocess.Popen(argv, cwd=cwd, stdout=out, stderr=subprocess.STDOUT,
                                    start_new_session=True, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
            try:
                code = proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.wait()
                code = 124
        result.append({'argv': argv, 'exit_code': code, 'seconds': round(time.monotonic()-started, 3)})
        if code:
            break
    return result


def verify(run, timeout=60):
    import fcntl
    run = Path(run).resolve()
    with (run / 'verify.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return _verify(run, timeout)


def _verify(run, timeout):
    started = time.monotonic()
    state = json.loads((run / 'manifest.json').read_text())
    plan, baseline, root = state['plan'], state['baseline'], Path(state['root'])
    report = {'status': 'FAIL', 'tasks': [], 'integration': [], 'errors': []}
    # Invalidate prior PASS before any operation that can fail.
    save(run / 'report.json', report)
    try:
        if inventory(root, scopes_of(plan)) != baseline:
            raise ValueError('source drift: prepare a fresh run')
        if inventory(run / 'base') != baseline:
            raise ValueError('baseline snapshot was modified')
        candidate = run / ('candidate-' + str(time.time_ns()))
        candidate.mkdir()
        copy_files(run / 'base', candidate, baseline)
        expected = dict(baseline)
        task_before = {}
        for t in plan['tasks']:
            folder = run / 'tasks' / t['id']
            current = inventory(folder)
            delta = changes(baseline, current)
            if any(not any(within(p, s) for s in t['writes']) for p in delta):
                raise ValueError('out-of-scope edit: ' + t['id'])
            task_before[t['id']] = current
            for rel in delta:
                if rel not in current:
                    (candidate / rel).unlink()
                    expected.pop(rel, None)
                else:
                    copy_files(folder, candidate, [rel])
                    expected[rel] = current[rel]
            report['tasks'].append({'id': t['id'], 'changed': delta, 'checks': []})
        if inventory(candidate) != expected:
            raise ValueError('candidate copy drift')
        with concurrent.futures.ThreadPoolExecutor(max_workers=plan.get('workers', 4)) as pool:
            futures = [pool.submit(check_commands, t.get('checks', []), run / 'tasks' / t['id'],
                                   run / 'logs' / t['id'], timeout) for t in plan['tasks']]
            for item, future in zip(report['tasks'], futures):
                item['checks'] = future.result()
        if any(c['exit_code'] for t in report['tasks'] for c in t['checks']):
            raise ValueError('task validation failed')
        report['integration'] = check_commands(plan.get('integration_checks', []), candidate,
                                               run / 'logs' / 'integration', timeout)
        if any(c['exit_code'] for c in report['integration']):
            raise ValueError('integration validation failed')
        for t in plan['tasks']:
            if inventory(run / 'tasks' / t['id']) != task_before[t['id']]:
                raise ValueError('task changed during verification: ' + t['id'])
        if inventory(candidate) != expected:
            raise ValueError('validator changed candidate files')
        if inventory(root, scopes_of(plan)) != baseline:
            raise ValueError('source drift during verification')
        if not plan.get('integration_checks') or any(not t.get('checks') for t in plan['tasks']):
            raise ValueError('checks required for every task and integration')
        report.update(status='PASS', candidate=str(candidate), files=expected)
    except (ValueError, OSError) as exc:
        report['errors'].append(str(exc))
    report['seconds'] = round(time.monotonic() - started, 3)
    save(run / 'report.json', report)
    return report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='action', required=True)
    a = sub.add_parser('plan'); a.add_argument('manifest')
    a = sub.add_parser('prepare'); a.add_argument('manifest'); a.add_argument('--root', required=True); a.add_argument('--run', required=True)
    a = sub.add_parser('verify'); a.add_argument('--run', required=True); a.add_argument('--timeout', type=int, default=60)
    args = p.parse_args()
    try:
        if args.action == 'plan':
            result = {'status': 'VALID', 'plan': load_plan(args.manifest)}
        elif args.action == 'prepare':
            result = prepare(args.root, args.manifest, args.run)
        else:
            if args.timeout <= 0: raise ValueError('timeout must be positive')
            result = verify(args.run, args.timeout)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return int(result['status'] == 'FAIL')
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({'status': 'FAIL', 'error': str(exc)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
