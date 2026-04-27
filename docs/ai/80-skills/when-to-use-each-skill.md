# When To Use Each Skill

Suggested routing:

- Before broad Resonance architecture/doc updates, read [resonance-skill-and-doc-update-pattern.md](/opt/Resonance/docs/ai/80-skills/resonance-skill-and-doc-update-pattern.md) and [resonance-design-patterns.md](/opt/Resonance/docs/architecture/resonance-design-patterns.md) so repeated changes land in the right canonical layers instead of spawning duplicate docs.

- Use `carbonet-ai-session-orchestrator` first on any implementation request to decide whether the work stays in one session or should split across multiple sessions with conflict-free path ownership.
- Use `carbonet-audit-trace-architecture` when the task is about audit logging, trace correlation, page or component registry, or system-wide governance across frontend and backend.
- Use `carbonet-common-project-boundary-switcher` when the real question is whether a page, module, menu, or contract should become common definition plus project binding instead of staying project-local.
- Use `carbonet-screen-builder` when the task is about turning existing pages into builder-managed or installable page units, not only when a drag-and-drop editor is explicitly mentioned.
- Use `docs/architecture/page-systemization-minimum-contract.md` as the first checklist when someone asks whether a page is really systemized, reusable, installable, or authority-scope-complete.
- Use `docs/architecture/builder-folder-refactor-priority-map.md` when the task is specifically about builder-oriented folder cleanup, path ordering, or module cutover execution order.
- When builder implementation is already in progress, prefer same-family incremental folder cleanup during that builder slice rather than leaving obvious structural drift for later.
- Use `docs/architecture/large-move-completion-contract.md` when the user explicitly wants a large move to finish in a closed state with one source of truth per selected family.
- If the currently active sessions already cover the needed ownership families, prefer finishing with those sessions rather than opening more implementation lanes.
- For builder-oriented platformization, common/project boundary work, large folder moves, or ownership closure, treat `4 sessions` as the default partition regardless of whether they are opened under 1 account or several accounts.
- Use `carbonet-react-refresh-consistency` when changing React build output, shell templates, Spring static resource delivery, or any cache behavior that affects whether frontend changes appear immediately after a hard refresh.
- Use `carbonet-screen-design-workspace` when the task starts from `/home/imaneya/workspace/화면설계`, especially when the top-level `1.`, `2.`, `3.`, `4.` HTML files should drive scope, IA, or workflow interpretation.
- Use `carbonet-feature-builder` when implementing or extending a Carbonet screen, menu, service, mapper, or DB metadata.
  - Keep page-management, feature-management, and authority-chain work in the same session when they share `AdminSystemCodeController`, bilingual page templates, menu-feature metadata, or authority mappers.
  - Treat `페이지 등록 -> PAGE_CODE_VIEW 생성 -> 권한 수동 검토 -> 페이지 삭제 시 기본 VIEW 정리` as one connected implementation path, not separate independent tasks.
  - Treat `메뉴 -> 페이지 -> 기능 -> 권한그룹 -> 회원/부서 할당 -> 사용자 예외권한 -> 감사로그` as one connected permission chain.
  - For the current admin restoration track, keep `auth_group`, `auth_change`, `dept_role_mapping`, `member_edit`, `admin_account` synchronized and restore original templates before polishing migrated UI abstractions.
  - Use it for `/admin/system/security-policy` when the task includes detection rules, suppress/baseline behavior, SQL preview/rollback, approval workflow, notification routing, or real runtime remediation in auth/rate-limit/audit code.
- Use `admin-screen-unifier` with `docs/architecture/admin-system-screen-completion-audit.md` when asked to list administrator system screens, find unfinished screens, or decide whether an existing rendered admin page is only `PARTIAL` or `SCAFFOLD`.
- Use `carbonet-join-react-migration` when the task is specifically about join, company register, status, or reapply flows in React migration.
