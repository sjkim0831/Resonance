import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("src/features/public-entry/PublicEntryPages.tsx");
const source = fs.readFileSync(sourcePath, "utf8");
const appSource = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");
const routeBoundarySource = fs.readFileSync(path.resolve("src/app/routes/RouteAuthenticationBoundary.tsx"), "utf8");

if (!source.includes("const redirectUrl = body.certified === false")
  || !source.includes('buildLocalizedPath("/home", "/en/home")')) {
  console.error("[login-authority-redirect] FAIL successful sign-in must enter the shared home workspace");
  process.exit(1);
}

if (/const redirectUrl\s*=\s*body\.userSe\s*===\s*"USR"/.test(source)) {
  console.error("[login-authority-redirect] FAIL user type must not grant admin console access");
  process.exit(1);
}

if (!appSource.includes("<RouteAuthenticationBoundary page={page} routePath={routePath}>")
  || !routeBoundarySource.includes('actorFamily.startsWith("PUBLIC_")')
  || !routeBoundarySource.includes("window.location.replace(loginPath)")) {
  console.error("[login-authority-redirect] FAIL governed non-public routes must fail closed through the shared boundary");
  process.exit(1);
}

console.log("[login-authority-redirect] PASS sign-in home redirect and governed route authentication are contract-based");
