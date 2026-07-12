import fs from "node:fs";

const [specPath, inventoryPath, outputPath] = process.argv.slice(2);
if (!specPath || !inventoryPath || !outputPath) throw new Error("usage: spec inventory output");

const lines = fs.readFileSync(specPath, "utf8").split(/\r?\n/).map((v) => v.trim());
const inventory = fs.readFileSync(inventoryPath, "utf8").split(/\r?\n/).map((line) => {
  const m = line.match(/^(\S+)\s+(.*?)\s+(\/\S+|#)\s+[YN]\s+[YN]$/);
  return m ? { code: m[1], name: m[2], url: m[3] } : null;
}).filter(Boolean);
const norm = (v) => v.normalize("NFKC").replace(/[\s·ㆍ()]/g, "").toLowerCase();
const exactUrl = new Map();
for (const row of inventory) if (row.url !== "#" && !exactUrl.has(norm(row.name))) exactUrl.set(norm(row.name), row.url);

const topCodes = {
  user: ["H101","H102","H103","H104","H105","H106","H107","H108"],
  admin: ["A101","A102","A103","A104","A105","A106","A107","A108","A109","A110","A111"]
};
const middleCodes = {
  "통합 홈":"H10101","내 업무·일정":"H10102","지표·알림·소식":"H10103",
  "현황·프로젝트":"H10201","활동자료":"H10202","산정·검증":"H10203","확정·보고":"H10204",
  "LCA 프로젝트":"H10301","인벤토리":"H10302","산정·분석":"H10303","보고":"H10304",
  "목표·계획":"H10401","감축 과제":"H10402","성과 관리":"H10403","포트폴리오":"H10404",
  "공급·수요":"H10601","거래":"H10602","추적·무결성":"H10603","크레딧·인증":"H10604",
  "교육":"H10701","정보":"H10702","지원":"H10703",
  "회원 관리":"A10201","기업 관리":"A10202","권한 관리":"A10203",
  "프로젝트 운영":"A10301","자료 수집":"A10302","검증·승인":"A10303","결과·보고":"A10304",
  "LCA 데이터":"A10402","LCA 산정·보고":"A10403",
  "조직·배출원":"A10601","산정 기준":"A10602","데이터 기준":"A10603",
  "콘텐츠":"A10801","고객지원":"A10803","정산·결제":"A10902","인증서":"A10903",
  "메뉴·화면":"A11101","기능·API":"A11102","보안·감사":"A11103","운영·배포":"A11104"
};
const defaults = {
  H101:"H10101",H102:"H10201",H103:"H10301",H104:"H10401",H105:"H10501",H106:"H10601",H107:"H10701",H108:"H10801",
  A101:"A10101",A102:"A10201",A103:"A10301",A104:"A10401",A105:"A10501",A106:"A10601",A107:"A10701",A108:"A10801",A109:"A10901",A110:"A11001",A111:"A11101"
};

let scope = "user", topIndex = -1, top = "", middle = "", started = false;
const leaves = [];
for (const line of lines) {
  if (line === "2. 관리자 화면 메뉴") { scope = "admin"; topIndex = -1; started = false; continue; }
  if (line.startsWith("3. 권장 최종 대메뉴")) break;
  const topMatch = line.match(/^(\d+)\)\s*(.+)$/);
  if (topMatch) {
    topIndex = Number(topMatch[1]) - 1;
    top = topCodes[scope][topIndex] || "";
    middle = defaults[top] || "";
    started = Boolean(top);
    continue;
  }
  if (!started || !line || line.startsWith("_") || line.includes(":") || /[.。]$/.test(line)) continue;
  if (line.startsWith("•")) {
    const name = line.replace(/^•\s*/, "").trim();
    if (name && middle) leaves.push({ scope, top, middle, name });
    continue;
  }
  if (middleCodes[line] && middleCodes[line].startsWith(top)) middle = middleCodes[line];
}

const unique = new Map();
for (const leaf of leaves) unique.set(`${leaf.middle}|${leaf.name}`, leaf);
const counters = new Map();
const rows = [];
for (const leaf of unique.values()) {
  const n = (counters.get(leaf.middle) || 0) + 1; counters.set(leaf.middle, n);
  if (n > 99) continue;
  const code = `${leaf.middle}${String(n).padStart(2,"0")}`;
  rows.push({ ...leaf, code, url: exactUrl.get(norm(leaf.name)) || "#" });
}
const q = (v) => `'${v.replaceAll("'", "''")}'`;
let sql = `-- generated from approved menu specification\nCREATE TEMP TABLE final_leaf(code varchar(20) primary key, code_id varchar(20), name_ko varchar(200), menu_url varchar(500), sort_order integer) ON COMMIT DROP;\nINSERT INTO final_leaf VALUES\n`;
sql += rows.map((r,i) => `(${q(r.code)},${q(r.scope === "user" ? "HMENU1" : "AMENU1")},${q(r.name)},${q(r.url)},${i+1})`).join(",\n") + ";\n";
sql += `\nINSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id) SELECT code_id,code,name_ko,name_ko,'Y',CURRENT_TIMESTAMP,'MENU_FINAL_LEAF',CURRENT_TIMESTAMP,'MENU_FINAL_LEAF' FROM final_leaf ON CONFLICT(code_id,code) DO UPDATE SET code_nm=EXCLUDED.code_nm,use_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_FINAL_LEAF';\n`;
sql += `INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at) SELECT code,name_ko,name_ko,menu_url,'article','Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'Y' FROM final_leaf ON CONFLICT(menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm,menu_url=EXCLUDED.menu_url,use_at='Y',expsr_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP;\n`;
sql += `INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm) SELECT code,sort_order,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM final_leaf ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr,last_updt_pnttm=CURRENT_TIMESTAMP;\n`;
fs.writeFileSync(outputPath, sql, "utf8");
console.log(JSON.stringify({ parsed: leaves.length, unique: rows.length, linked: rows.filter(r => r.url !== "#").length, unlinked: rows.filter(r => r.url === "#").length }));
