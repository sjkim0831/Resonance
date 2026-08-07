import { existsSync, lstatSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot=path.dirname(fileURLToPath(import.meta.url));
const frontendRoot=path.resolve(scriptRoot,"..");
const generatedRoot=path.join(frontendRoot,"src/generated/screen-generation");
const sharedRoot=path.resolve(process.env.SHARED_GENERATED_SCREEN_DIR||
  "/opt/Resonance/projects/carbonet-frontend/source/src/generated/screen-generation");
const required=[
  {name:"definitions",type:"dir"},
  {name:"generatedScreenTypes.ts",type:"file"},
];

mkdirSync(generatedRoot,{recursive:true});
for(const asset of required){
  const target=path.join(generatedRoot,asset.name);
  if(existsSync(target))continue;
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
console.log(`[generated-screen-assets] ready count=${required.length}`);
