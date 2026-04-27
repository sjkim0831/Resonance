# Skill Gaps

Track recurring task types that still require too much manual prompting.

Suggested columns if converted to CSV later:

- task type
- why current skills are insufficient
- repeated errors or omissions
- candidate new skill
- candidate reference files

## Current Gaps

### Runtime Topology Reference Expansion

- Task type:
  - topology variants that go beyond the current `carbonet-runtime-topology-ops` baseline
  - concrete runbooks for internal port exposure, Nginx upstream automation, and staged rollout
  - capacity heuristics backed by measured app memory and DB CAS numbers
- Why current skills are insufficient:
  - the new skill defines guardrails and decision order, but still needs concrete environment-specific runbooks and reference data
- Repeated errors or omissions:
  - jumping from topology discussion straight into server changes without a node-role map
  - using “shared memory” language when the intent is really shared worker-node scheduling
  - missing measured connection-pool and CAS budgets before increasing instance counts
- Candidate follow-up assets:
  - references for `Jenkins + Nomad + main/sub web + idle pool`
  - DB CAS sizing examples and per-system pool formulas
  - latest-file versus archive-file movement runbooks
  - Nginx upstream and internal-port conventions

### Operations-System Scaffold And Release Runbooks

- Task type:
  - end-to-end flow from scaffold JSON authoring to common-artifact build, project-artifact build, Jenkins publication, Nomad rollout, and DB archive registration
  - common runtime module promotion such as auth, PDF, Excel, and file adapters
  - project folder mapping and code-generation ownership checks
- Why current skills are insufficient:
  - current architecture docs define the target model, but do not yet provide a concrete operator runbook or artifact contract checklist
- Repeated errors or omissions:
  - mixing draft JSON authoring data with archive DB rows
  - describing central build authority without defining artifact publication and rollback checkpoints
  - forgetting stable facade rules for common jars, causing likely import churn in project systems
- Candidate follow-up assets:
  - scaffold JSON schema examples
  - common-artifact publication checklist
  - project-artifact release manifest template
  - rollback and compatibility approval runbook
  - common facade design examples for auth, PDF, Excel, and storage

### Codex Structured Generation Contracts

- Task type:
  - Codex CLI-assisted screen generation from JSON and registry metadata
  - low-token prompt policies for scaffold, repair, and binding assistance
  - standardized controller/service/VO/DTO/mapper generation contracts
- Why current skills are insufficient:
  - current docs define where Codex participates, but not the exact payload contract or when template generation should win over Codex generation
- Repeated errors or omissions:
  - using verbose prose prompts where normalized scaffold JSON should be enough
  - unclear split between direct template scaffolding and Codex-assisted repair
  - function and API binding rules described conceptually but not as machine-oriented contracts
- Candidate follow-up assets:
  - scaffold JSON payload examples
  - Codex assist mode matrix
  - function-binding manifest example
  - API-binding manifest example
  - backend scaffold output checklist

### Project-First, Classification, And CSRF Contracts

- Task type:
  - forcing all generation and deployment work to start from explicit project selection
  - classification-scoped member search, output, and export contracts
  - CSRF policy generation for state-changing browser flows
- Why current skills are insufficient:
  - the architecture now points in this direction, but there is no dedicated skill that teaches how to keep project binding, member classification, and CSRF policy aligned across builder, backend, and frontend work
- Repeated errors or omissions:
  - generating draft assets before binding a project
  - treating member classification as only a UI filter instead of a query and export contract
  - adding CSRF late in controllers instead of generating it from scenario policy
- Candidate follow-up assets:
  - project-first scaffold checklist
  - member-classification-policy examples
  - csrf-policy examples
  - search/export classification audit checklist

### Scaffold Request, App Runtime, And DB Integrity Contracts

- Task type:
  - defining one authoritative `scaffold-request.json` payload for generation
  - governing JS behavior across browser, mobile web, hybrid app, and wrapper runtimes
  - enforcing PK, FK, index, and query-shape integrity during DB scaffolding
- Why current skills are insufficient:
  - architecture now points to these contracts, but there is still no dedicated skill or checklist that ties scaffold payload, runtime capabilities, and DB integrity together
- Repeated errors or omissions:
  - starting generation from partial form metadata instead of one normalized scaffold request
  - handling mobile-app JS with ad hoc checks
  - creating DB objects without explicit key and index review
- Candidate follow-up assets:
  - `scaffold-request.json` examples
  - `app-runtime-profile.json` examples
  - PK/FK/index generation checklist
  - reference workspace canonical-source indexing checklist

Status update:

- architecture-level contracts now exist for scaffold request, runtime bridge governance, and DB integrity
- the remaining gap is implementation skill and operator checklist quality, not the absence of architecture direction

### Version Governance And Upgrade Runbooks

- Task type:
  - common platform version registration
  - module version publication
  - project version binding and compatibility review
  - release unit approval, rollout, and rollback
- Why current skills are insufficient:
  - versioning principles exist in architecture docs, but the operator-facing screen flow and checklist are still implicit
- Repeated errors or omissions:
  - treating artifact version as build metadata only
  - skipping explicit project-version binding and compatibility review
  - not defining which screen confirms rollback readiness and applied target history
- Candidate follow-up assets:
  - version dashboard IA
  - project binding matrix example
  - compatibility-check result schema
  - release-unit approval checklist
  - rollback readiness checklist

### Central-Plane Versus Runtime-Plane Chain Gaps

- Task type:
  - explicit chain from control-plane version binding to runtime active release state
  - active/target/rollback version-state visibility across backend, frontend, static assets, and policy bundles
  - project system separation while still consuming centrally published artifacts
- Why current skills are insufficient:
  - current docs state the split model, but operators still lack a concise chain for how central decisions become active runtime state
- Repeated errors or omissions:
  - documenting approved versions without documenting currently active versions
  - forgetting rollback-target tracking for frontend/static assets
  - mixing project-owned source with central artifact lines conceptually
- Candidate follow-up assets:
  - control-plane to runtime-plane state diagram
  - active/target/rollback matrix example
  - release-unit asset family checklist
  - project runtime binding workflow

### ELK And Audit Correlation Runbooks

- Task type:
  - centralized ELK log ingestion for app, Nginx, Jenkins, Nomad, security, and DB operation logs
  - correlation between ELK search records and authoritative audit/trace records
  - retention, masking, and alert rules for operational logs
- Why current skills are insufficient:
  - audit and trace architecture exists, but the operator runbook for ELK pipeline ownership and correlation keys is still implicit
- Repeated errors or omissions:
  - treating logs and immutable audit as the same store
  - missing releaseUnitId or projectId correlation in cross-node logs
  - adding dashboards without defining log family ownership and masking rules
- Candidate follow-up assets:
  - ELK pipeline ownership diagram
  - log family and index policy matrix
  - required correlation-key checklist
  - masking and retention checklist for ELK

### Performance-First Optional Stack Runbooks

- needed for:
  - Redis, micro-cache, summary-table, lightweight search, worker queue, and prompt-cache adoption
  - deciding when to use Loki instead of ELK
  - deciding when advanced stacks must move to dedicated nodes instead of runtime web nodes
- why still missing:
  - architecture mentions speed-oriented helpers and optional stacks, but there is no concise operator runbook for attachment criteria, memory budget, and rollback
- should eventually include:
  - stack-to-host-class decision table
  - memory budget guide for 1GB nodes
  - enable/disable and rollback checklist

### High-Speed Scaffolding And Algorithm Guidance

- Task type:
  - high-speed project generation and scaffold assembly
  - low-latency lookup for menu, page, component, API, and function registries
  - dependency-graph planning for create/update/delete/regenerate flows
  - summary, cache, dedupe, and fast-path strategies for the operations system itself
- Why current skills are insufficient:
  - performance notes exist, but there is no dedicated skill guidance for choosing algorithms and data structures while implementing scaffold, registry, and generation workflows
- Repeated errors or omissions:
  - using repeated linear scans where indexed maps or snapshots should be used
  - rebuilding full dependency chains instead of caching normalized graph state
  - missing bounded-memory and summary-snapshot rules in scaffold-heavy admin paths
  - treating algorithm decisions as incidental instead of part of the platform contract
- Candidate follow-up assets:
  - scaffold hot-path algorithm checklist
  - registry index and cache patterns
  - dependency-graph and delete-plan algorithm patterns
  - summary/materialized snapshot guidance
  - probabilistic structure guidance for heavy-hitter, dedupe, and blocklist fast paths

### Requirement-Domain Module And Auto-Generation Contracts

- Task type:
  - mapping requirement-domain modules from `/opt/reference/화면설계/설계/00_요구사항매핑.txt` into managed module lists
  - auto-generating menu-aligned screens and backend chains from requirement/module metadata
  - preserving user/admin paired flows and approval/reject mappings during generation
- Why current skills are insufficient:
  - current docs mention menu and screen generation, but do not yet define the exact contract for requirement-module ingestion and menu-driven auto generation APIs
- Repeated errors or omissions:
  - treating requirement domains as passive reference text instead of first-class managed modules
  - generating screens without preserving mapped admin-review counterparts
  - losing traceability from generated assets back to requirement-domain and UC identifiers
- Candidate follow-up assets:
  - requirement-domain module schema
  - menu-to-screen generation API contract
  - user/admin pair-generation rules
  - approval/reject API mapping checklist

### Complexity And Source Governance Screens

- Task type:
  - operator-facing screens for ownership chain, execution chain, delete chain, source asset registry, and generated artifact workspace
  - visibility into whether an asset belongs to the control plane or a project runtime system
  - traceability from requirement/design source to generated code and deployed artifact
- Why current skills are insufficient:
  - the architecture states the chain model, but the concrete menu and screen responsibilities for complexity/resource/source governance are still easy to under-specify
- Repeated errors or omissions:
  - having registry tables without operator screens that explain the chain
  - losing the link between design documents, generated sources, and deployed artifacts
  - not exposing delete blockers and rollback blockers in one place
- Candidate follow-up assets:
  - complexity dashboard IA
  - ownership/execution/delete chain screen wireframes
  - source asset registry schema
  - generated artifact workspace schema

### Admin System Screen Completion Closure

- Task type:
  - auditing `/admin/system`, `/admin/external`, and `/admin/monitoring` administrator screens for real completion instead of route-only rendering
  - converting starter/static/read-only admin screens into action-backed operations consoles
  - deciding which missing function belongs to common ops, general admin, or project admin ownership
- Why current skills are insufficient:
  - `admin-screen-unifier` covers visual and page-family consistency, while `carbonet-feature-builder` covers implementation, but teams still need a shared status model for `COMPLETE`, `PARTIAL`, and `SCAFFOLD`
  - route existence and React rendering were too easy to mistake for business or operations completion
- Repeated errors or omissions:
  - claiming completion without checking mutation endpoints, audit, storage, and authority feature codes
  - leaving static sample dashboards under system operations menus
  - treating thin wrappers as distinct screens without documenting alias behavior
- Current canonical audit:
  - `docs/architecture/admin-system-screen-completion-audit.md`
- Current closure backlog:
  - `docs/architecture/admin-system-screen-closure-backlog.md`
  - `docs/ai/20-ui/admin-system-screen-completion-map.csv`
- Candidate follow-up assets:
  - per-screen closure tickets for each `PARTIAL` screen
  - route-to-action-feature matrix for system operations screens
  - runtime verification route checklist for screens whose missing function changes `:18000` behavior

### High-Parallel Multi-Account Collaboration Orchestration

- Task type:
  - using many Codex accounts or collab-driven sessions in parallel on one repository
  - deciding whether `8`, `10`, or `14` available accounts should actually become active implementation lanes
  - keeping account-to-lane ownership, standby lanes, and resume routing explicit
- Why current skills are insufficient:
  - `carbonet-ai-session-orchestrator` defines safe ownership and split rules well, but it does not yet provide a concise operator-facing playbook for high-account-count scheduling decisions and collab-specific lane activation policy
- Repeated errors or omissions:
  - assuming more accounts means more safe concurrent write lanes
  - opening duplicate convenience lanes for the same shared file family
  - deleting older orchestration docs without first confirming which live handoff doc is still authoritative
- Candidate follow-up assets:
  - high-parallel account activation matrix
  - collab lane state model
  - active versus standby lane checklist
  - latest-live-doc preservation checklist
  - archive/delete decision table for orchestration artifacts

Status update:

- a live baseline now exists in `docs/architecture/high-parallel-account-orchestration-playbook.md`
- the remaining gap is a more concrete operator UI/state contract, not the absence of a baseline operating rule

### Operations UI Frame And State Contracts

- Task type:
  - defining mature operations-console page shells, frame profiles, action zones, diagnostics panels, comparison views, and help rails
  - keeping registry, builder, deploy, observability, and policy pages visually and behaviorally aligned
- Why current skills are insufficient:
  - layout standards exist, but there is still no dedicated skill that teaches how to keep operations UI context, state handling, action hierarchy, diagnostics, and responsive behavior consistent across the entire Resonance console
- Repeated errors or omissions:
  - designing a page around fields and buttons without defining draft, read-only, degraded, or impact-preview states
  - missing help rail, diagnostics drawer, or comparison view on governance-heavy pages
  - drifting button placement and page header structure between screens that should share the same frame family
- Candidate follow-up assets:
  - operations frame-profile contract
  - help and diagnostics rail standard
  - draft/published/current/target comparison UI checklist
  - bottom-action and destructive-action layout rules
  - responsive operations-console layout guide

### Security Scaffold And Runtime Enforcement

- Task type:
  - making security part of scenario, scaffold, build, release-unit, and runtime governance instead of late review
  - aligning actor scope, masking, file access, transport security, and deny-audit behavior across generated code
- Why current skills are insufficient:
  - security is referenced throughout the architecture, but there is still no dedicated skill that teaches how to keep generated frontend, backend, runtime transport, and release gates aligned under one security contract family
- Repeated errors or omissions:
  - adding CSRF but forgetting masking or download policy
  - treating transport security as infrastructure-only and not part of release readiness
  - generating file or export paths without explicit deny and audit policy
- Candidate follow-up assets:
  - security-profile contract examples
  - masking-policy and file-access-policy examples
  - transport-security release checklist
  - release-unit security gate checklist

### Generation Trace And Release Traceability

- Task type:
  - tracking how generated frontend, backend, DB, and release-unit assets changed over time
  - letting operators select version sets, deploy them, and roll back with full provenance
- Why current skills are insufficient:
  - architecture now states the desired traceability, but there is still no dedicated skill that teaches how to keep generation runs, asset diffs, release-unit bindings, and rollback views aligned
- Repeated errors or omissions:
  - knowing what was deployed without knowing what was generated
  - tracking backend or DB output but not the frontend manifest side
  - missing rollback trace from generated asset to selected version line
- Candidate follow-up assets:
  - generation-run explorer checklist
  - generated-asset trace schema examples
  - release-unit asset matrix walkthrough
  - rollback target explorer checklist

### Productization Supportability And Entitlement

- Task type:
  - turning Resonance from an internal control plane into a distributable product with onboarding, entitlement, installer, and support-export flows
- Why current skills are insufficient:
  - the architecture now supports product packaging, but there is still no dedicated skill that teaches how to keep tenant onboarding, license or entitlement binding, support snapshots, and module enablement aligned with release units
- Repeated errors or omissions:
  - treating productization as only packaging jars
  - forgetting entitlement and customer bootstrap profiles
  - missing support snapshot and diagnostic export flows
- Candidate follow-up assets:
  - tenant onboarding checklist
  - entitlement bundle schema
  - installer/bootstrap profile schema
  - support snapshot export checklist

### Installable Module And Plug-In Contracts

- Task type:
  - attaching or removing new technology stacks as governed installable modules
  - enabling or disabling operational capabilities such as AI runners, blockchain adapters, log adapters, or policy bundles without uncontrolled source edits
  - defining install, uninstall, replace, and rollback contracts for shared capabilities
- Why current skills are insufficient:
  - the architecture now points to installable modules, but there is no concrete contract guidance for module lifecycle, attachment points, or removal safety
- Repeated errors or omissions:
  - treating every new stack as a hard-coded platform change
  - copying source into project systems instead of binding approved modules
  - forgetting uninstall and rollback conditions for newly attached capabilities
- Candidate follow-up assets:
  - installable module contract schema
  - plug-in lifecycle state diagram
  - module binding and detach checklist
  - rollback and orphan-resource checklist for removed modules

### Chain Matrix And Build-First Governance

- Task type:
  - enforcing that shared capabilities are always both installable and buildable
  - operating module, screen, server, and artifact lifecycle through ownership/execution/deploy/delete/rollback matrices
  - preventing uncontrolled runtime-side source drift while still allowing fast add or replace flows
- Why current skills are insufficient:
  - the docs now state the direction, but there is not yet a concrete schema or operator pattern for matrix-driven lifecycle management
- Repeated errors or omissions:
  - defining install units without explicit build contracts
  - documenting rollback conceptually without a visible matrix of blockers and previous targets
  - allowing resource edits without a clear source-to-build and build-to-runtime trail
- Candidate follow-up assets:
  - chain-matrix table schema
  - build-first module checklist
  - active/target/previous version matrix example
  - delete and rollback blocker query patterns

### Cross-Repository Module Fusion And Internal Catalog Governance

- Task type:
  - later fusion of approved modules from sibling repositories such as `/opt/projects/carbosys`
  - importing reusable system modules into the control-plane internal catalog without collapsing repository boundaries
  - preserving theme, design-source, and module compatibility while making future integration easy
- Why current skills are insufficient:
  - current docs now prefer internal catalogs and installable modules, but there is not yet a concrete process for harvesting or normalizing modules from other controlled repositories
- Repeated errors or omissions:
  - assuming future cross-repo reuse will be a simple copy task
  - mixing external source trees directly into runtime projects
  - lacking a normalization checklist for component, theme, API, and module metadata before fusion
- Candidate follow-up assets:
  - cross-repo module intake checklist
  - internal-catalog normalization schema
  - sibling-repo compatibility review template
  - design-source and theme fusion checklist

### Scenario-First Scaffold And Action-Layout Contracts

- Task type:
  - requiring scenario registration before menu, page, and feature generation
  - generating standard action bars, grid toolbars, and search-form layouts from governed profiles
  - keeping frequently used button placement and common screen blocks centrally reusable
- Why current skills are insufficient:
  - the architecture now requires scenario-first and action-layout contracts, but there is not yet a concrete schema or generation guide for these assets
- Repeated errors or omissions:
  - generating screens directly from menu names without use-case or actor context
  - ad hoc button placement and repeated search/grid markup drift
  - missing traceability from actions and buttons back to scenario intent
- Candidate follow-up assets:
  - scenario-definition schema
  - action-layout schema
  - reusable search-form and grid block contract
  - button-zone default matrix

### Cron, Retention, And Orphan Cleanup Governance

- Task type:
  - managing cron jobs, retention rules, archive expiration, and automatic cleanup through governed lifecycles
  - preventing leftover garbage files, temporary artifacts, and orphan storage state
  - making deletion and cleanup safe, auditable, and reversible
- Why current skills are insufficient:
  - retention and cleanup policies are now architecture requirements, but there is not yet a concrete schema or runbook for cron-managed deletion and orphan cleanup
- Repeated errors or omissions:
  - leaving archive or temp files without retention ownership
  - describing cleanup policies without execution history and rollback windows
  - handling cron jobs as simple shell snippets instead of governed runtime assets
- Candidate follow-up assets:
  - cron job schema
  - retention-policy schema
  - orphan-cleanup checklist
  - delete-preview and approval workflow

### Scenario Family, Language, And Responsive Generation Contracts

- Task type:
  - treating one business capability such as join or signup as a family of many pages
  - generating Korean, English, mobile, responsive, public, and admin-pair variants from one scenario bundle
  - keeping frontend structure aligned with scenario family and shared components instead of ad hoc per-page divergence
- Why current skills are insufficient:
  - the architecture now states scenario-first rules, but there is not yet a concrete contract for scenario-family bundles, language variants, and responsive derivation
- Repeated errors or omissions:
  - assuming one menu or one business label equals one page
  - underestimating join-like flows where one capability expands into many screens
  - creating language and mobile variants as disconnected pages instead of governed derivatives
- Candidate follow-up assets:
  - scenario-family schema
  - language-profile schema
  - responsive-profile schema
  - join-family reference mapping

### Actor Policy And Authority Chain Contracts

- Task type:
  - connecting actor, role, data scope, menu permission, feature permission, API permission, component action, and button visibility in one generation chain
  - reflecting current Carbonet authority patterns such as system, admin, operation, company, and department-scoped roles
  - generating screens that already know their actor and scope model before implementation begins
- Why current skills are insufficient:
  - the architecture now requires actor-first scenario binding, but there is not yet a concrete schema or generation guide for actor policies and authority propagation
- Repeated errors or omissions:
  - defining pages before role and scope assumptions are explicit
  - separating frontend action visibility from backend authority contracts
  - forgetting scoped-company or scoped-department variants until late in implementation
- Candidate follow-up assets:
  - actor-policy schema
  - actor-to-feature matrix
  - scoped-role inheritance rules
  - button and component authority-gate contract

### Operational Configuration, Translation, And Notification Contracts

- Task type:
  - managing i18n translation workflows, environment overrides, secret or certificate rotation, notification templates, and retry policy as governed control-plane assets
  - connecting these assets to release units and rollout review
- Why current skills are insufficient:
  - the architecture mentions related capabilities, but there is not yet a concrete contract or menu-level schema for these operational assets
- Repeated errors or omissions:
  - leaving translation and notification assets outside the main governance chain
  - treating environment overrides as ad hoc configuration instead of controlled release inputs
  - not linking secret or certificate lifecycle to deploy and policy review
- Candidate follow-up assets:
  - translation workflow schema
  - notification-template lifecycle schema
  - environment override schema
  - secret and certificate rotation runbook

### Notification Provider, Retry, And Certificate Rotation Contracts

- Task type:
  - updating mail, SMS, certificate, and secret-backed common capabilities without breaking project systems
  - separating provider adapters, template bundles, retry policies, failover groups, and rotation policies
  - ensuring notification and certificate updates remain versioned, auditable, and rollback-aware
- Why current skills are insufficient:
  - common-module rules exist, but there is not yet a concrete governance contract for notification and certificate provider lifecycle
- Repeated errors or omissions:
  - mixing provider credentials, templates, and adapters into one upgrade event
  - lacking retry and failover policy definitions before provider changes
  - rotating certificates or secrets without explicit operator review and rollback window
- Candidate follow-up assets:
  - provider-profile schema
  - failover-group schema
  - retry-policy schema
  - certificate and secret rotation workflow

### Current Runtime Parity And Requirement-Loss Audit

- Task type:
  - proving that requirement-driven generation can reproduce the current Carbonet join, signin, admin-login, popup, grid, and approval families without silent omission
  - identifying which current backend assets, file widgets, third-party adapters, and server/log bindings are still outside governed promotion
- Why current skills are insufficient:
  - the architecture is now broad, but there is not yet a concrete parity-audit playbook that compares generated assets against current runtime assets family by family
- Repeated errors or omissions:
  - declaring parity from route coverage alone
  - missing popup, upload, export, or nested approval action assets
  - not checking server-role, log-source, and audit-source coverage together with screen generation
- Candidate follow-up assets:
  - generated-result compare checklist
  - current-runtime asset promotion checklist
  - server and log family coverage checklist
  - join and admin-login parity audit workbook

### Parity, Uniformity, And Repair Statistics Contracts

- Task type:
  - parity compare payloads for current runtime, generated result, baseline, and patch target
  - uniformity statistics for shell, page-frame, component spacing, density, and action-layout drift
  - repair-open and repair-apply contracts driven by runtime evidence
- Why current skills are insufficient:
  - current architecture now requires parity and uniformity to be measurable, but no dedicated skill yet standardizes the compare payloads, drift metrics, or repair queue workflow
- Repeated errors or omissions:
  - discussing parity as a visual review instead of a governed compare artifact
  - detecting spacing or frame drift manually instead of through runtime statistics
  - opening ad hoc fixes without binding them to repair sessions and patch release units
- Candidate follow-up assets:
  - parity-compare payload schema
  - uniformity statistics schema
  - repair-open and repair-apply API examples
  - repair queue prioritization checklist

### Selected-Screen Repair, Linked Menu Registration, And SQL Draft Governance

- Task type:
  - selecting one existing or generated screen and issuing targeted repair instructions against included elements
  - keeping menu, page, feature, common-code, authority, event, function, backend, and DB chain linked during repair
  - generating governed DDL, migration, data patch, and rollback SQL for existing table or column updates
- Why current skills are insufficient:
  - architecture now supports targeted repair and SQL draft publication, but no dedicated skill yet teaches how to keep selected-screen repair, menu registration, and DB SQL drafting aligned
- Repeated errors or omissions:
  - repairing a page visually without following its menu, feature, and backend chain
  - generating SQL mentally or ad hoc instead of as governed drafts
  - updating existing tables or seed data without explicit rollback drafts
- Candidate follow-up assets:
  - selected-screen repair workflow
  - linked menu/page/feature registration checklist
  - DDL/migration/data-patch/rollback SQL draft examples
  - current-runtime asset reuse checklist

### Main-Server Cron Binding And Deployable Asset Boundary

- Task type:
  - binding project cron jobs to the correct main runtime server
  - distinguishing control-plane-only menus/screens/scenarios from runtime-deployable outputs
  - preventing scheduler and governance surfaces from leaking into general systems
- Why current skills are insufficient:
  - the architecture now assumes main-server cron ownership and deployable-asset boundaries, but there is not yet a concrete skill or checklist for enforcing those decisions during generation and deployment
- Repeated errors or omissions:
  - treating cron as a generic shell job without runtime role ownership
  - shipping control-plane governance screens into runtime admin packages
  - failing to declare whether a scenario family is deployable or reference-only
- Candidate follow-up assets:
  - main-server cron registration checklist
- deployable versus control-plane-only asset matrix

### Chain-Matrix Operator Completeness

Why this still matters:

- the architecture now assumes chain and matrix governance across menu, scenario, page, component, backend, DB, release-unit, parity, and rollout families
- but there is still no dedicated implementation skill or checklist for ensuring every governed resource appears in the required matrix surfaces

Common failure modes:

- defining chain tables without exposing them in operator-facing matrix screens
- showing release-unit matrices but not menu/scenario/page/component matrices
- repairing screens without updating parity or runtime-truth matrices
- allowing resources to exist outside any operator-facing chain or matrix explorer

Needed next:

- chain-matrix operator checklist
- matrix-family coverage verification
- row-to-row pivot and blocker resolution workflow
  - scheduler ownership verification checklist

### Menu-To-Rendered-Screen Parity Verification

- Task type:
  - verifying that a registered menu actually renders the intended governed page and that all linked actions work after deployment
  - preventing release of menu nodes that resolve only partially or depend on hidden manual patching
- Why current skills are insufficient:
  - the architecture now links menu, page, feature, backend, and DB chains, but there is not yet a dedicated skill or checklist for proving that the rendered runtime page matches the registered intent end to end
- Repeated errors or omissions:
  - checking route registration without checking actual rendered shell and component output
  - assuming backend/API completeness means the runtime page is release-ready
  - missing post-deploy render verification for menus that appear valid in metadata
- Candidate follow-up assets:
  - menu-to-rendered-screen verification checklist
  - post-deploy render smoke checklist
  - menu render defect classification guide

### Import-Aware Upgrade And Framework-Line Selection

- Task type:
  - centrally managing shared code lines that may require project import or signature updates
  - publishing framework lines and common-module lines that projects explicitly choose
  - preventing silent import-breaking upgrades from leaking into project runtimes
- Why current skills are insufficient:
  - the docs now distinguish stable facades and import-aware lines, but there is not yet a concrete operator workflow or schema for reviewing and approving those upgrades
- Repeated errors or omissions:
  - treating all shared module upgrades as equally safe
  - not distinguishing facade-safe upgrades from import-aware upgrades
  - missing explicit project-side line selection when framework or common contracts change
- Candidate follow-up assets:
  - framework-line registry schema
  - import-aware upgrade review workflow
  - module-line selection matrix
  - project impact checklist for shared contract changes

### AI-Parallel Delivery Partitioning For Resonance

- Task type:
  - splitting Resonance implementation into multiple AI tracks without causing shared-contract collisions
  - deciding which parts may be parallelized and which must stay serialized
  - defining merge order for contract, backend, frontend, scaffold, deploy, and observability work
- Why current skills are insufficient:
  - the session orchestrator exists, but there is not yet a Resonance-specific partition map tied to the actual platform build phases
- Repeated errors or omissions:
  - parallelizing screen or deploy work before shared contracts are stable
  - allowing multiple sessions to edit the same contract family
  - skipping a dedicated verification track at the end
- Candidate follow-up assets:
  - Resonance AI-track partition map
  - allowedPaths/forbiddenPaths per track
  - merge order checklist
  - shared-contract ownership table

### Multi-Account Session Governance For Resonance

- Task type:
  - running multiple AI accounts or agents in parallel on the Resonance build without shared-contract collisions
  - assigning session ownership per track, file family, and handoff boundary
- Why current skills are insufficient:
  - the general session orchestrator exists and the Resonance partition map exists, but there is still no repository-local contract for account-to-session ownership and handoff discipline
- Repeated errors or omissions:
  - opening concurrent sessions with overlapping contract edits
  - treating track names as enough without path ownership
  - letting dependent sessions proceed before coordinator freeze and handoff
- Candidate follow-up assets:
  - account-to-session ownership template
  - session handoff summary template
  - merge queue checklist
  - coordinator re-freeze checklist

### `msaManager` Absorption And Unified Operator Surface

- Task type:
  - mapping the current `/opt/util/msaManager` operator actions into Resonance control-plane menus and APIs
  - preventing duplicate build/deploy/restart/operator surfaces between legacy utility screens and new Resonance menus
  - ensuring future generated systems use the same governed operator contracts
- Why current skills are insufficient:
  - the architecture references `msaManager`, but there is not yet a dedicated implementation skill for absorbing its useful operator behavior into one unified control-plane experience
- Repeated errors or omissions:
  - keeping separate utility semantics for current systems and generated systems
  - wiring build/package/restart without release-unit, common jar, and rollback context
  - reproducing legacy tabs without reclassifying them into control-plane-only menus
- Candidate follow-up assets:
  - `msaManager` to Resonance menu map
  - operator macro and script registry checklist
  - current-system versus generated-system operator parity checklist

### Design Workspace Mature Output And Help Coverage

- Task type:
  - turning `/opt/reference/화면설계/설계` document families into governed, printable, mature output packages that can drive scaffold generation directly
  - ensuring every governed screen ships with complete help content and aligned help anchors
- Why current skills are insufficient:
  - design-source intake exists conceptually, but there is not yet dedicated skill guidance for converting the full reference design workspace into mature output bundles and mandatory help coverage contracts
- Repeated errors or omissions:
  - storing design files without converting them into reusable result packages
  - generating screens without complete help content or aligned `data-help-id` markers
  - treating help as page copy instead of a governed screen asset
- Candidate follow-up assets:
  - design-family output package checklist
  - help-content and help-anchor contract examples
  - reference workspace indexing and print-output checklist
  - screen-to-help coverage verification checklist

### Requirement Coverage And Pre-Registered Design Enforcement

- Task type:
  - checking whether requirement-driven generation omitted page families, element families, or supporting blocks before scaffold publish
  - forcing screen output to use only pre-registered design assets, page frames, action layouts, and approved components
- Why current skills are insufficient:
  - the architecture now assumes requirement coverage audit and pre-registered design output, but there is not yet a dedicated skill for running those checks and enforcing those gates
- Repeated errors or omissions:
  - generating pages before missing element families are registered
  - allowing ad hoc button placement or one-off layout blocks during final authoring
  - treating design registration as optional instead of the source of output truth
- Candidate follow-up assets:
  - requirement coverage audit checklist
  - missing page/element registration workflow
  - pre-registered design output checklist
  - action-layout enforcement guide

### DB Integrity And High-Speed Schema Generation

- Task type:
  - generating DB objects with enforced PK, FK, index, and integrity rules
  - keeping control-plane and runtime queries fast under scaffold-heavy and search-heavy workloads
- Why current skills are insufficient:
  - current docs mention DB linkage and high-speed lookup helpers, but there is not yet a dedicated contract for integrity-first schema generation and index review
- Repeated errors or omissions:
  - generating tables without explicit primary and foreign key intent
  - adding search/export features without corresponding index review
  - treating DB speed as only hardware concern instead of schema and query contract concern
- Candidate follow-up assets:
  - PK/FK/index generation checklist
  - query-shape to index-review checklist
  - scaffolded DB object integrity contract
  - materialized snapshot and summary-table guidance

### JSON Workspace Durability And Revision Governance

- Task type:
  - separating JSON authoring assets from DB governance records without losing rollback and provenance
  - keeping AI and user edits versioned, durable, and recoverable
  - binding published assets and release units back to exact JSON revision sets
- Why current skills are insufficient:
  - architecture now defines JSON workspace registry, revision lineage, and publish binding, but there is still no dedicated skill or checklist that teaches how to implement and operate that split safely
- Repeated errors or omissions:
  - treating a local draft file as the only source of truth
  - storing current draft state without immutable revision lineage
  - publishing generated assets without preserving JSON revision pointers
  - recording asset changes without recording whether the change came from AI or user action
- Candidate follow-up assets:
  - JSON workspace registry checklist
  - revision-save and checksum policy
  - AI-edit versus user-edit provenance checklist
  - draft rollback and publish-binding checklist

### Project-Proposal Onboarding Inventory Operation

- Task type:
  - checking whether a new project created from a proposal upload generated the full expected menu, scenario, page, binding, backend, and DB asset set before build
  - operating a per-project proposal-generation matrix that links source proposal coverage to runtime parity readiness
- Why current skills are insufficient:
  - the architecture now defines project-first proposal onboarding, generated asset counts, and project proposal generation matrix views, but there is not yet a dedicated implementation skill for building and operating that inventory end to end
- Repeated errors or omissions:
  - building a project after proposal synthesis without confirming generated asset counts
  - treating scenario families as complete without checking step-level page and binding coverage
  - losing visibility into how many backend and DB assets were produced from the proposal baseline
- Candidate follow-up assets:
  - project proposal generation inventory API checklist
  - project proposal generation matrix operator checklist
