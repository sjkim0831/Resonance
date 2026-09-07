import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=fs.readFileSync('src/features/emission-survey-admin/surveyAmountValidation.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {validateSurveyAmounts:v}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const row=(amount,sectionCode='INPUT_ENERGY')=>({amount,sectionCode,sectionLabel:'시험',materialName:'시험'});
const output=row('1','OUTPUT_PRODUCTS');
const cases=[
 ['blank', [row(''),output],false],['whitespace',[row('  '),output],false],
 ['negative',[row('-1'),output],false],['invalid',[row('abc'),output],false],
 ['infinity',[row('Infinity'),output],false],['zero output',[row('1'),row('0','OUTPUT_PRODUCTS')],false],
 ['no output',[row('1')],false],['empty',[],false],
 ['explicit zero',[row('0'),output],true],['valid',[row('1'),output],true],
 ['decimal',[row('0.25'),output],true],['comma',[row('1,000'),output],true]
];
for(const [name,rows,expected] of cases){const original=JSON.stringify(rows);assert.equal(v(rows).valid,expected,name);assert.equal(JSON.stringify(rows),original,'mutated '+name);console.log('PASS '+name);}
console.log(`${cases.length}/${cases.length} PASS, input mutation 0`);
