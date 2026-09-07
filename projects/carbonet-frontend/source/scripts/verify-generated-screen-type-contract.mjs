import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GENERATED_SCREEN_TYPES_SOURCE } from "./generated-screen-type-contract.mjs";

const scriptsRoot=path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot=await mkdtemp(path.join(tmpdir(),"generated-screen-type-contract-"));
const sharedRoot=path.join(fixtureRoot,"shared");
// Windows developer shells may not have symlink privilege. Using the shared
// root still exercises repair/idempotency there; POSIX additionally verifies
// the deploy-worktree link path.
const generatedRoot=process.platform==="win32"?sharedRoot:path.join(fixtureRoot,"generated");

try{
  await mkdir(path.join(sharedRoot,"definitions"),{recursive:true});
  await writeFile(path.join(sharedRoot,"generatedScreenTypes.ts"),
    "export type GeneratedScreenDefinition={id:string};\n");

  const first=spawnSync(process.execPath,[path.join(scriptsRoot,"ensure-shared-generated-screen-assets.mjs")],{
    encoding:"utf8",
    env:{...process.env,SHARED_GENERATED_SCREEN_DIR:sharedRoot,GENERATED_SCREEN_DIR:generatedRoot},
  });
  assert.equal(first.status,0,first.stderr);
  assert.match(first.stdout,/typeContractRepaired=1/);
  assert.equal(await readFile(path.join(sharedRoot,"generatedScreenTypes.ts"),"utf8"),GENERATED_SCREEN_TYPES_SOURCE);
  assert.equal((await stat(path.join(generatedRoot,"definitions"))).isDirectory(),true);
  assert.equal(await readFile(path.join(generatedRoot,"generatedScreenTypes.ts"),"utf8"),GENERATED_SCREEN_TYPES_SOURCE);
  assert.match(GENERATED_SCREEN_TYPES_SOURCE,/screenCoordinate:ScreenCoordinate/);
  assert.match(GENERATED_SCREEN_TYPES_SOURCE,/screenCoordinateKey:string/);

  const second=spawnSync(process.execPath,[path.join(scriptsRoot,"ensure-shared-generated-screen-assets.mjs")],{
    encoding:"utf8",
    env:{...process.env,SHARED_GENERATED_SCREEN_DIR:sharedRoot,GENERATED_SCREEN_DIR:generatedRoot},
  });
  assert.equal(second.status,0,second.stderr);
  assert.match(second.stdout,/typeContractRepaired=0/);
  console.log("[generated-screen-type-contract] PASS stale=1 repaired=1 idempotent=1");
}finally{
  await rm(fixtureRoot,{recursive:true,force:true});
}
