// Decode labels as text only. Never interpret stored menu labels as HTML.
export function menuText(value: unknown): string {
  const entities: Record<string, string> = { amp: "&", middot: "·", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">" };
  return String(value ?? "").replace(/&(#x[0-9a-f]+|#\d+|amp|middot|nbsp|quot|apos|lt|gt);/gi, (match, key: string) => {
    if (!key.startsWith("#")) return entities[key.toLowerCase()] ?? match;
    const code = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match;
  });
}

type SearchNode = { code: string; label: string; url: string; icon: string; useAt?: string; children: SearchNode[] };
export function filterMenuTree<T extends SearchNode>(nodes: T[], keyword: string, useAt: string): T[] {
  const query = menuText(keyword).trim().toLocaleLowerCase();
  return nodes.flatMap(node => {
    const children = filterMenuTree(node.children, keyword, useAt);
    const matches = (!query || menuText([node.code, node.label, node.url, node.icon].join(" ")).toLocaleLowerCase().includes(query))
      && (!useAt || node.useAt === useAt);
    return matches || children.length ? [{ ...node, children } as T] : [];
  });
}

export function duplicateMenu(rows: Array<Record<string, unknown>>, parent: string, label: string, url: string) {
  const normalizedLabel = menuText(label).trim().toLocaleLowerCase();
  const normalizedUrl = url.trim().replace(/\/$/, "");
  return rows.find(row => {
    const code = String(row.code ?? "");
    const path = String(row.menuUrl ?? row.url ?? "").trim().replace(/\/$/, "");
    const name = menuText(row.codeNm ?? row.label).trim().toLocaleLowerCase();
    return path === normalizedUrl || (code.length === parent.length + 2 && code.startsWith(parent) && name === normalizedLabel);
  });
}
