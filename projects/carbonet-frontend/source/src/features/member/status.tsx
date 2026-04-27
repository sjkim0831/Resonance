export function resolveMemberStatusBadgeClass(rawValue: unknown) {
  switch (String(rawValue || "").trim().toUpperCase()) {
    case "P":
      return "bg-emerald-100 text-emerald-700";
    case "A":
      return "bg-blue-100 text-blue-700";
    case "R":
      return "bg-amber-100 text-amber-700";
    case "D":
      return "bg-slate-200 text-slate-700";
    case "X":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function resolveMemberStatusLabel(rawValue: unknown) {
  switch (String(rawValue || "").trim().toUpperCase()) {
    case "P":
      return "활성";
    case "A":
      return "승인 대기";
    case "R":
      return "반려";
    case "D":
      return "삭제";
    case "X":
      return "차단";
    default:
      return String(rawValue || "기타");
  }
}
