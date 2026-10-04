import fs from 'node:fs';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const base = new URL('../src/features/emission-project-list/', import.meta.url);
const policy = JSON.parse(fs.readFileSync(new URL('emissionProjectPortfolioLayout.json', base), 'utf8'));
const file = fileURLToPath(new URL('EmissionProjectPortfolioPage.tsx', base));
const source = fs.readFileSync(file, 'utf8');

function violations(text) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = ast.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  for (const label of policy.forbiddenText || []) {
    if (text.includes(label)) errors.push(`Forbidden panel text: ${label}`);
  }
  let titles = 0;
  let create = 0;
  const visit = node => {
    if (ts.isIdentifier(node) && policy.forbiddenComponents.includes(node.text)) errors.push(`Forbidden component: ${node.text}`);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (policy.forbiddenLinks.some(path => node.text.includes(path))) errors.push('Duplicate project-list link');
      if (policy.forbiddenSummaryIcons.includes(node.text)) errors.push(`Summary card icon: ${node.text}`);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(ast) === 'h1') titles++;
      const marker = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'data-layout-section');
      const value = marker?.initializer && ts.isStringLiteral(marker.initializer) ? marker.initializer.text : '';
      if (policy.forbiddenSections.includes(value)) errors.push(`Forbidden section: ${value}`);
      if (value === 'list-create') {
        create++;
        let parent = node.parent;
        while (parent && !(ts.isJsxElement(parent) && parent.openingElement.tagName.getText(ast) === 'section')) parent = parent.parent;
        if (!parent || !parent.getText(ast).includes('<table')) errors.push('Create action must be inside project list section');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (titles !== policy.titleCount) errors.push(`Expected ${policy.titleCount} h1, got ${titles}`);
  if (create !== 1) errors.push(`Expected one list-create action, got ${create}`);
  return errors;
}

const errors = violations(source);
// Verify the gate actually rejects each previously removed decoration.
for (const mutation of ['const x = EmissionPageIntro;', 'const x = "/emission/project_list";', 'const x = "monitoring";']) {
  if (violations(source + '\n' + mutation).length === 0) errors.push(`Guard failed mutation: ${mutation}`);
}
if (errors.length) {
  console.error(`Portfolio layout policy FAIL:\n${errors.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Portfolio layout policy PASS: one title, list create action, no intro/statistics/duplicate link; 3 regression mutations rejected.');
}
