import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../projects/carbonet-frontend/source/src/features/emission-project-list/EmissionProjectResultPage.tsx", import.meta.url),
  "utf8",
);

const required = [
  'min-h-screen min-w-0 overflow-x-hidden',
  'flex min-w-0 flex-col gap-2 sm:flex-row',
  'w-full rounded-lg border border-blue-700',
  'w-full rounded-lg bg-[#246beb]',
  'grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]',
  'min-w-0 overflow-hidden rounded-xl border bg-white',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`missing mobile calculation contract: ${token}`);
}

if (source.includes('className="flex gap-2"')) {
  throw new Error("unwrapped calculation action row returned");
}

console.log(`EMISSION_CALCULATION_MOBILE_CONTRACT_PASS assertions=${required.length + 1}`);
