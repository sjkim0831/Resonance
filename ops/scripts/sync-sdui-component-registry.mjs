#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const storePath = path.join(root, "projects/carbonet-backend-metadata/builder/platform-builder-store.json");
const outputPath = process.argv[2] || path.join(root, "var/run/sdui-component-registry-sync.sql");

if (!fs.existsSync(storePath)) throw new Error(`Builder store not found: ${storePath}`);
const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
const components = (store.components || []).filter((component) =>
  !String(component.componentId || "").startsWith("SOURCE_COMPONENT_") &&
  String(component.componentId || "") !== "SOURCE_PAGE" &&
  String(component.useAt || "Y") !== "N"
);

function literal(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function componentType(value) {
  const normalized = String(value || "other").toLowerCase();
  const aliases = { form: "section", card: "section", layout: "section", other: "section" };
  return aliases[normalized] || normalized;
}

const statements = components.map((component) => {
  const metadata = JSON.stringify({
    propsTemplate: component.defaultProps || {},
    labelEn: component.componentNmEn || "",
    description: component.componentDc || "",
    status: "ACTIVE",
    replacementComponentId: "",
    sourceType: "BUILDER_STUDIO",
    className: component.defaultClassNm || "",
    style: component.defaultStyle || {},
    dataAttrs: component.dataAttrs || {}
  });
  return `INSERT INTO UI_COMPONENT_REGISTRY
    (COMPONENT_ID, COMPONENT_NAME, COMPONENT_TYPE, OWNER_DOMAIN, PROPS_SCHEMA_JSON, DESIGN_REFERENCE, ACTIVE_YN, CREATED_AT, UPDATED_AT)
  VALUES (${literal(component.componentId)}, ${literal(component.componentNm || component.componentId)}, ${literal(componentType(component.componentType))},
    'BUILDER_STUDIO', ${literal(metadata)}, ${literal(component.componentDc || "")}, 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT (COMPONENT_ID) DO UPDATE SET
    COMPONENT_NAME = EXCLUDED.COMPONENT_NAME,
    COMPONENT_TYPE = EXCLUDED.COMPONENT_TYPE,
    PROPS_SCHEMA_JSON = EXCLUDED.PROPS_SCHEMA_JSON,
    DESIGN_REFERENCE = EXCLUDED.DESIGN_REFERENCE,
    ACTIVE_YN = EXCLUDED.ACTIVE_YN,
    UPDATED_AT = CURRENT_TIMESTAMP
  WHERE UI_COMPONENT_REGISTRY.OWNER_DOMAIN = 'BUILDER_STUDIO'
    AND (UI_COMPONENT_REGISTRY.COMPONENT_NAME, UI_COMPONENT_REGISTRY.COMPONENT_TYPE,
         UI_COMPONENT_REGISTRY.PROPS_SCHEMA_JSON, UI_COMPONENT_REGISTRY.DESIGN_REFERENCE,
         UI_COMPONENT_REGISTRY.ACTIVE_YN)
        IS DISTINCT FROM
        (EXCLUDED.COMPONENT_NAME, EXCLUDED.COMPONENT_TYPE,
         EXCLUDED.PROPS_SCHEMA_JSON, EXCLUDED.DESIGN_REFERENCE, EXCLUDED.ACTIVE_YN);`;
});

const sql = [
  "-- Generated from the builder-studio registry. Manual DB-owned rows are preserved.",
  ...statements,
  `SELECT COUNT(*) AS builder_studio_component_count FROM UI_COMPONENT_REGISTRY WHERE OWNER_DOMAIN = 'BUILDER_STUDIO';`,
  ""
].join("\n\n");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.next`;
fs.writeFileSync(temporaryPath, sql);
fs.renameSync(temporaryPath, outputPath);
console.log(JSON.stringify({ outputPath, componentCount: components.length }));
