import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("src/features/public-entry/PublicEntryPages.tsx");
const source = fs.readFileSync(sourcePath, "utf8");

if (!source.includes('const redirectUrl = body.canEnterAdminConsole === true')) {
  console.error("[login-authority-redirect] FAIL admin redirect must use canEnterAdminConsole");
  process.exit(1);
}

if (/const redirectUrl\s*=\s*body\.userSe\s*===\s*"USR"/.test(source)) {
  console.error("[login-authority-redirect] FAIL user type must not grant admin console access");
  process.exit(1);
}

console.log("[login-authority-redirect] PASS admin redirect is authority-based");
