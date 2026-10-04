import json, urllib.request
base = 'http://127.0.0.1:5000/v2/'
def get(path):
    with urllib.request.urlopen(base + path, timeout=15) as r:
        return json.load(r)
for repo in get('_catalog')['repositories']:
    tags = get(repo + '/tags/list').get('tags') or []
    print(json.dumps({'repository': repo, 'tag_count': len(tags)}, ensure_ascii=False))
