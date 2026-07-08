export type GitVersionInventoryRow = {
  hash: string;
  subject: string;
};

export const GIT_VERSION_INVENTORY: GitVersionInventoryRow[] = [
  { hash: "372f31e9f5", subject: "Add-git-version-promotion-workbench" },
  { hash: "2544df34d4", subject: "Refine-unified-builder-workspace-layout" },
  { hash: "fe8a90aed3", subject: "Add SDUI menu tree editing workspace" },
  { hash: "d2f854c187", subject: "Enhance normalized builder composition workspace" },
  { hash: "71b62033b7", subject: "Show content-only preview in builder workspace" },
  { hash: "3142b86b3f", subject: "Constrain builder edits to content area" },
  { hash: "513c22216f", subject: "Add unified builder workspace" },
  { hash: "93ac102f6d", subject: "Add builder UI candidate preview modal" },
  { hash: "b31f4dc552", subject: "Add UI recommendation workflow to builder" },
  { hash: "b39bf5d36c", subject: "Persist builder sections and frontend candidates" }
];
