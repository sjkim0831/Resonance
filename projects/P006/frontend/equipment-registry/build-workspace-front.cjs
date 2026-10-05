#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const templatePath = path.join(root, 'workspace-front.template.html');
const mapPath = path.join(root, 'workspace-front.parts.json');
const currentPath = path.join(root, 'production-workspace-front.html');
const digest = (text) => crypto.createHash('sha256').update(text).digest('hex');

function initialize(sourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const parts = { format: 1, styles: [], scripts: [] };
  const edits = [];
  const tagPattern = /<(script|style)\b([^>]*)>/gi;
  let match;
  while ((match = tagPattern.exec(source))) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const closeTag = `</${tag}>`;
    const closeStart = source.toLowerCase().indexOf(closeTag, tagPattern.lastIndex);
    if (closeStart < 0) throw new Error(`닫는 ${closeTag} 태그가 없습니다.`);
    const closeEnd = closeStart + closeTag.length;
    if (tag === 'script' && /\bsrc\s*=/.test(attrs)) {
      tagPattern.lastIndex = closeEnd;
      continue;
    }
    if (tag === 'style') {
      const id = parts.styles.length;
      const filename = `workspace-front-${id}.css`;
      let body = source.slice(tagPattern.lastIndex, closeStart);
      const suffix = body.match(/(?:\r?\n){2,}$/)?.[0] || '';
      if (suffix) body = body.slice(0, -suffix.length);
      fs.writeFileSync(path.join(root, filename), body, 'utf8');
      parts.styles.push({ attrs, filename, suffix });
      edits.push({ start: match.index, end: closeEnd, marker: `<!-- WORKSPACE_STYLE_${id} -->` });
    } else {
      const id = parts.scripts.length;
      const filename = `workspace-front-inline-${id}.${/\btype\s*=\s*["']application\/json["']/i.test(attrs) ? 'json' : 'js'}`;
      let body = source.slice(tagPattern.lastIndex, closeStart);
      const suffix = body.match(/(?:\r?\n){2,}$/)?.[0] || '';
      if (suffix) body = body.slice(0, -suffix.length);
      fs.writeFileSync(path.join(root, filename), body, 'utf8');
      parts.scripts.push({ attrs, filename, suffix });
      edits.push({ start: match.index, end: closeEnd, marker: `<!-- WORKSPACE_SCRIPT_${id} -->` });
    }
    tagPattern.lastIndex = closeEnd;
  }
  let html = source;
  for (const edit of edits.reverse()) html = html.slice(0, edit.start) + edit.marker + html.slice(edit.end);
  fs.writeFileSync(templatePath, html, 'utf8');
  fs.writeFileSync(mapPath, `${JSON.stringify(parts, null, 2)}\n`, 'utf8');
  console.log(`분리 완료: style ${parts.styles.length}, inline script ${parts.scripts.length}`);
}

function build() {
  const parts = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  let html = fs.readFileSync(templatePath, 'utf8');
  for (let i = 0; i < parts.styles.length; i += 1) {
    const part = parts.styles[i];
    const body = fs.readFileSync(path.join(root, part.filename), 'utf8') + (part.suffix || '');
    html = html.replace(`<!-- WORKSPACE_STYLE_${i} -->`, `<style${part.attrs}>${body}</style>`);
  }
  for (let i = 0; i < parts.scripts.length; i += 1) {
    const part = parts.scripts[i];
    const body = fs.readFileSync(path.join(root, part.filename), 'utf8') + (part.suffix || '');
    html = html.replace(`<!-- WORKSPACE_SCRIPT_${i} -->`, `<script${part.attrs}>${body}</script>`);
  }
  return html;
}

const mode = process.argv[2];
if (mode === '--init') {
  if (!process.argv[3]) throw new Error('사용법: node build-workspace-front.cjs --init <기존 HTML>');
  initialize(path.resolve(process.argv[3]));
} else if (mode === '--check') {
  const generated = build();
  const current = fs.readFileSync(process.argv[3] ? path.resolve(process.argv[3]) : currentPath, 'utf8');
  if (generated !== current) {
    let offset = 0;
    while (offset < generated.length && generated[offset] === current[offset]) offset += 1;
    console.error(`불일치 offset=${offset}: generated=${digest(generated)} current=${digest(current)}`);
    console.error(`generated: ${JSON.stringify(generated.slice(Math.max(0, offset - 60), offset + 100))}`);
    console.error(`current:   ${JSON.stringify(current.slice(Math.max(0, offset - 60), offset + 100))}`);
    process.exitCode = 1;
  } else {
    console.log(`일치: ${digest(generated)} (${Buffer.byteLength(generated)} bytes)`);
  }
} else if (mode === '--build') {
  const generated = build();
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : currentPath;
  fs.writeFileSync(outputPath, generated, 'utf8');
  console.log(`생성: ${outputPath} (${Buffer.byteLength(generated)} bytes, sha256 ${digest(generated)})`);
} else {
  console.error('사용법: node build-workspace-front.cjs --init <기존 HTML> | --build [출력 경로] | --check [비교 경로]');
  process.exitCode = 2;
}
