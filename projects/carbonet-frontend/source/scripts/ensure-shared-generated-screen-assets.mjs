import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_SCREEN_TYPES_SOURCE } from "./generated-screen-type-contract.mjs";

const scriptRoot=path.dirname(fileURLToPath(import.meta.url));
const frontendRoot=path.resolve(scriptRoot,"..");
const generatedRoot=path.resolve(process.env.GENERATED_SCREEN_DIR||
  path.join(frontendRoot,"src/generated/screen-generation"));
const sharedRoot=path.resolve(process.env.SHARED_GENERATED_SCREEN_DIR||
  "/opt/Resonance/projects/carbonet-frontend/source/src/generated/screen-generation");
const required=[
  {name:"definitions",type:"dir"},
  {name:"generatedScreenTypes.ts",type:"file"},
];

function atomicWriteIfChanged(target,content){
  if(existsSync(target)&&readFileSync(target,"utf8")===content)return false;
  mkdirSync(path.dirname(target),{recursive:true});
  const temporary=`${target}.tmp-${process.pid}`;
  writeFileSync(temporary,content);
  renameSync(temporary,target);
  return true;
}

// The shared directory can outlive a deploy worktree. Repair its small type
// contract before linking it so newly generated definitions and stale shared
// assets can never enter TypeScript with different shapes.
const sharedTypes=path.join(sharedRoot,"generatedScreenTypes.ts");
const typeContractRepaired=atomicWriteIfChanged(sharedTypes,GENERATED_SCREEN_TYPES_SOURCE);

mkdirSync(generatedRoot,{recursive:true});
for(const asset of required){
  const target=path.join(generatedRoot,asset.name);
  if(existsSync(target)){
    if(asset.name==="generatedScreenTypes.ts")atomicWriteIfChanged(target,GENERATED_SCREEN_TYPES_SOURCE);
    continue;
  }
  const source=path.join(sharedRoot,asset.name);
  if(!existsSync(source)){
    throw new Error(`generated screen asset is unavailable: ${asset.name}; sharedRoot=${sharedRoot}`);
  }
  const sourceStat=lstatSync(source);
  if(asset.type==="dir"&&!sourceStat.isDirectory()){
    throw new Error(`generated screen asset must be a directory: ${source}`);
  }
  if(asset.type==="file"&&!sourceStat.isFile()){
    throw new Error(`generated screen asset must be a file: ${source}`);
  }
  symlinkSync(source,target,asset.type==="dir"?"dir":"file");
  console.log(`[generated-screen-assets] linked ${asset.name}`);
}

for(const asset of required){
  const target=path.join(generatedRoot,asset.name);
  if(!existsSync(target))throw new Error(`generated screen asset link failed: ${target}`);
}
console.log(`[generated-screen-assets] ready count=${required.length} typeContractRepaired=${typeContractRepaired?1:0}`);
