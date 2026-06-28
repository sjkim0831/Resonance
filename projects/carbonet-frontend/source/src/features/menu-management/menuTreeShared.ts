import { numberOf, stringOf } from "../admin-system/adminSystemShared";

export type MenuTreeNode = {
  code: string;
  label: string;
  url: string;
  icon: string;
  sortOrdr: number;
  children: MenuTreeNode[];
  useAt?: string;
  expsrAt?: string;
};

type BuildMenuTreeOptions = {
  labelKeys?: string[];
  mapUrl?: (value: string) => string;
  includeUseAt?: boolean;
  includeExposure?: boolean;
};

export function parentMenuCode(code: string) {
  const len = code.length;
  if (len === 8) return code.slice(0, 6);
  if (len === 6) return code.slice(0, 4);
  if (len === 4) return "";
  return "";
}

export function buildMenuTree(rows: Array<Record<string, unknown>>, options: BuildMenuTreeOptions = {}) {
  const {
    labelKeys = ["codeNm", "codeDc", "code"],
    mapUrl = (value) => value,
    includeUseAt = false,
    includeExposure = false
  } = options;
  const nodes = new Map<string, MenuTreeNode>();
  rows.forEach((row) => {
    const code = stringOf(row, "code").toUpperCase();
    if (!code) {
      return;
    }
    const label = labelKeys.reduce((result, key) => result || stringOf(row, key), "") || code;
    nodes.set(code, {
      code,
      label,
      url: mapUrl(stringOf(row, "menuUrl")),
      icon: stringOf(row, "menuIcon") || "menu",
      sortOrdr: numberOf(row, "sortOrdr"),
      children: [],
      ...(includeUseAt ? { useAt: stringOf(row, "useAt") || "Y" } : {}),
      ...(includeExposure ? { expsrAt: stringOf(row, "expsrAt") || "Y" } : {})
    });
  });

  const roots: MenuTreeNode[] = [];
  nodes.forEach((node) => {
    const parent = nodes.get(parentMenuCode(node.code));
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: MenuTreeNode[]) => {
    items.sort((left, right) => {
      const leftOrder = left.sortOrdr > 0 ? left.sortOrdr : Number.MAX_SAFE_INTEGER;
      const rightOrder = right.sortOrdr > 0 ? right.sortOrdr : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.code.localeCompare(right.code);
    });
    items.forEach((item) => sortNodes(item.children));
  };

  sortNodes(roots);
  return roots;
}

export function updateMenuSortOrders(items: MenuTreeNode[]) {
  items.forEach((item, index) => {
    item.sortOrdr = index + 1;
    updateMenuSortOrders(item.children);
  });
}

export function flattenMenuOrderPayload(items: MenuTreeNode[], output: string[] = [], allowedPrefix?: string) {
  items.forEach((item, index) => {
    if (!allowedPrefix || item.code.startsWith(allowedPrefix)) {
      output.push(`${item.code}:${index + 1}`);
    }
    flattenMenuOrderPayload(item.children, output, allowedPrefix);
  });
  return output;
}

export function buildSuggestedPageCode(parentCode: string, rows: Array<{ code: string }>) {
  const len = parentCode.length;

  // 대메뉴 (4글자) 선택 → 중메뉴 (6글자) 코드 생성
  if (len === 4) {
    let maxSuffix = 0;
    rows.forEach((row) => {
      if (!row.code.startsWith(parentCode) || row.code.length !== 6) {
        return;
      }
      const suffix = Number(row.code.slice(4));
      if (Number.isFinite(suffix) && suffix > maxSuffix) {
        maxSuffix = suffix;
      }
    });
    if (maxSuffix >= 99) {
      return "";
    }
    return `${parentCode}${String(maxSuffix + 1).padStart(2, "0")}`;
  }

  // 중메뉴 (6글자) 선택 → 소메뉴 (8글자) 코드 생성
  if (len === 6) {
    let maxSuffix = 0;
    rows.forEach((row) => {
      if (!row.code.startsWith(parentCode) || row.code.length !== 8) {
        return;
      }
      const suffix = Number(row.code.slice(6));
      if (Number.isFinite(suffix) && suffix > maxSuffix) {
        maxSuffix = suffix;
      }
    });
    if (maxSuffix >= 99) {
      return "";
    }
    return `${parentCode}${String(maxSuffix + 1).padStart(2, "0")}`;
  }

  return "";
}
