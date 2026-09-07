import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const write = process.argv.includes("--write");
const targets = process.argv.slice(2).filter(value => value !== "--write").map(value => resolve(value));
if (!targets.length) throw new Error("usage: node scripts/apply-krds-control-classes.mjs [--write] <page.tsx> [...]");

const classFor = (tag, node, parsed) => {
  if (tag === "table") return "krds-control-table";
  if (tag === "button") return "krds-control-button";
  if (tag === "input") {
    const type = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(parsed) === "type");
    const literalType = type && ts.isJsxAttribute(type) && type.initializer && ts.isStringLiteral(type.initializer) ? type.initializer.text : "";
    if (["checkbox", "radio", "range", "file", "color"].includes(literalType)) return "krds-control-native";
  }
  return "krds-control-field";
};

const results = [];
for (const target of targets) {
  const source = await readFile(target, "utf8");
  const parsed = ts.createSourceFile(target, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(parsed);
      if (["button", "input", "select", "textarea", "table"].includes(tag)) {
        const governed = node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && ["class", "className", "data-krds-unstyled"].includes(attribute.name.getText(parsed)));
        if (!governed) edits.push({ position: node.attributes.end, text: ` className="${classFor(tag, node, parsed)}"`, tag });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  let output = source;
  for (const edit of edits.sort((a, b) => b.position - a.position)) output = `${output.slice(0, edit.position)}${edit.text}${output.slice(edit.position)}`;
  if (write && edits.length) await writeFile(target, output);
  results.push({ file: target, changed: edits.length, controls: Object.fromEntries(["button", "input", "select", "textarea", "table"].map(tag => [tag, edits.filter(edit => edit.tag === tag).length])) });
}

console.log(JSON.stringify({ write, files: results.length, changed: results.reduce((sum, result) => sum + result.changed, 0), results }, null, 2));
