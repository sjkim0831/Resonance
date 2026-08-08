#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
const root = process.env.RESONANCE_ROOT || process.cwd();
const file = path.join(root, "modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/feature/member/EntrprsManageMapper.xml");
const source = readFileSync(file, "utf8");
for (const id of ["insertEnterpriseSecurityMappingComtn", "insertEnterpriseSecurityMappingMsatn"]) {
  const block = source.match(new RegExp(`<insert id="${id}"[\\s\\S]*?<\\/insert>`))?.[0] || "";
  if (!block.includes("WHERE NOT EXISTS") || !block.includes("SELECT #{value}, 'USR02', 'ROLE_USER'")) throw new Error(`${id} insert-select contract missing`);
  if (/FROM\s+db_root/i.test(block)) throw new Error(`${id} references non-portable db_root`);
}
console.log("MEMBER_SECURITY_MAPPING_POSTGRES_CONTRACT_PASS inserts=2");
