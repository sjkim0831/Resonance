import fs from "node:fs";
const source=fs.readFileSync(new URL("../scripts/resonance-facility-operation-monitoring-e2e.mjs",import.meta.url),"utf8");
for(const token of ["const screenPathname = new URL(screenRoute, baseURL).pathname","pathname: screenPathname","new URLSearchParams(location.search).get(\"qaViewport\")"]){if(!source.includes(token))throw new Error(`PROCESS_RELAY_QUERY_ROUTE_MISSING ${token}`)}
if(source.includes("{ pathname: screenRoute, stepCode:"))throw new Error("PROCESS_RELAY_QUERY_ROUTE_LEGACY_COMPARISON");
const pathname=new URL("/emission/report-submission?step=regulatory_submission_s1","http://runtime").pathname;
if(pathname!=="/emission/report-submission")throw new Error("PROCESS_RELAY_QUERY_ROUTE_NORMALIZATION");
console.log("PROCESS_RELAY_QUERY_ROUTE_PASS query=preserved pathname=normalized");
