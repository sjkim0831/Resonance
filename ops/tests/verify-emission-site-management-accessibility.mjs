#!/usr/bin/env node
import {readFileSync} from "node:fs";
const source=readFileSync("projects/carbonet-frontend/source/src/features/emission-site-management/EmissionSiteManagementMigrationPage.tsx","utf8");
for(const label of ["Site code","Site name","Country","Status","Address","Boundary method","Data owner"]){if(!source.includes(`aria-label={en?"${label}"`))throw new Error(`site management control missing label: ${label}`)}
console.log("EMISSION_SITE_MANAGEMENT_ACCESSIBILITY_PASS controls=7");
