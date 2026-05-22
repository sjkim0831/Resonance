# Resonance Design Patterns

Generated on 2026-03-21 for the consolidated Resonance build-first pattern set.

## Goal

Reduce repeated architectural restatement by defining one compact pattern catalog for Resonance.

Use this document when the team needs to answer:

- what Resonance is
- what always belongs in the control plane
- what may be deployed to general systems
- how generation, build, deploy, compare, repair, rollback, and monitoring should connect
- how to evaluate whether a new feature request fits the existing architecture

This document is the short-form pattern layer above the more detailed contracts.

## Product Shape

Resonance is a build-first control-plane framework.

It is composed of:

- `Resonance Control Plane`
  - design, generation, governance, release, compare, repair, and rollout authority
- `Resonance Builder`
  - scenario-first scaffold and code generation chain
- `Resonance Runtime`
  - deployed general systems that consume approved runtime packages
- `Resonance Ops`
  - topology, server, macro, deploy, smoke, rollback, and monitoring control
- `Resonance AI`
  - AI provider, model, runner, repair, and generation assistance

## Pattern 1. Project-First

Nothing starts without explicit project selection.

Every governed flow must resolve:

- `projectId`
- selected framework line
- selected common jar line
- selected frontend bundle line
- selected theme and token line
- selected feature-module line
- target release unit

## Pattern 2. Scenario-First

No page is created before a scenario exists.

Every scenario must resolve:

- menu
- page
- feature
- route
- actor policy
- authority and classification policy
- CSRF policy when required
- required button group
- required popup/grid/search/upload/export/status blocks
- required API set
- required backend chain
- required DB object set

## Pattern 3. Page-And-Element Separation

Design should not start from one huge page blob.

Separate:

- `page design`
- `element design`
- `binding design`
- `page assembly`

Pages are assembled from registered designs, not hand-composed from scratch per screen.

## Pattern 4. Common-Component First

Repeated UI should become catalog assets before page-local variants are allowed.

Required component hierarchy:

- primitive
- composite block
- scenario-ready composite

Typical reusable families:

- header
- menu
- footer
- search form
- result grid
- popup selector
- summary card
- bottom action bar
- step wizard
- file section
- approval panel
- dashboard block

## Pattern 5. Theme And Layout Governance

Generated screens should be uniform by default.

Uniformity comes from:

- shell profile
- page frame
- action-layout profile
- theme package
- design token bundle
- spacing and density profile
- approved component catalog set

Do not allow page-local button placement or ad hoc spacing to bypass those profiles.

## Pattern 5-A. Template-Line Split

One project may share one runtime set while still keeping separate:

- public template lines
- admin template lines

Template lines should be first-class governed assets, not implicit conventions.

Admin template lines should be explicitly reusable and copyable for new projects.

## Pattern 5-B. Screen-Family Rule

One screen family should map to one approved UI rule profile.

That profile should govern:

- shell profile
- page frame
- action layout
- slot profiles
- spacing and density
- approved component families
- help and diagnostics structure

AI editing is allowed only inside the approved family boundary.

## Pattern 6. HTML5 Semantic Output

Generated React output should prefer semantic HTML5 structure.

Required landmarks and semantics should come from governed primitives:

- `header`
- `nav`
- `main`
- `section`
- `article`
- `aside`
- `footer`
- real buttons, links, forms, dialogs, fieldsets, and labels

## Pattern 7. Full-Stack Generation

Scaffolding is never frontend-only.

The minimum full-stack chain is:

- menu
- page
- feature
- component set
- event binding
- function binding
- API binding
- backend chain
- DB object set
- SQL draft family
- help and diagnostics metadata
- security and authority metadata

Expected backend outputs:

- controller
- service
- serviceImpl
- VO
- DTO
- mapper Java
- mapper XML
- SQL draft or migration draft

## Pattern 8. Control Plane Versus Runtime

The control plane owns design and governance.

General systems consume runtime packages.

Control-plane-only examples:

- scenario governance
- component and theme governance
- design workspace
- compare and repair
- release-unit and compatibility control
- server, macro, deploy, log, cron, retention governance

Runtime-deployable examples:

- public home/signin/join
- business list/detail/edit/review
- popup/grid/search/report/approval screens
- ordinary runtime-admin CRUD and inquiry screens

## Pattern 9. Thin Runtime

General systems should remain thin.

Keep centrally:

- upgrade-sensitive common backend code
- shared frontend bundles
- shared theme/token/CSS/JS bundles
- shared runtime behavior such as popup/grid/search/action-layout logic
- auth, file, PDF, Excel, notification, certificate, security, and masking lines

Keep project-local only:

- route and page binding
- project-specific thin adapters
- project-local query delta
- project business data access

## Pattern 10. Project-Unit Build And Deploy

Generation, build, and deploy are handled by project unit.

Every project-unit deployment must resolve:

- main server
- sub server when present
- idle-node participation when present
- DB server
- release unit
- runtime package matrix

No deployment should rely on undocumented target-server edits.

Required deployment confidence:

- main, sub, idle, and DB server roles are explicitly mapped
- main-server smoke and current-runtime checks exist
- release-unit asset matrix matches the server-role map
- target runtime does not require manual source patching after artifact delivery

## Pattern 10-A. Control-Plane-First Resonance

Carbonet should not pretend that Resonance is already a full autonomous multi-agent operating system when the repository only implements part of that target.

Current canonical interpretation:

- implement Resonance first as a `control-plane execution and repair system`
- then extend it toward richer autonomous orchestration

The minimum Carbonet Resonance shape is:

- governed execution console
- operator-visible prepare/plan/execute flow
- runtime compare and repair loop
- verification and freshness proof
- replayable episodic evidence

Do not describe the repository as having full Resonance capability unless these are also true:

- semantic memory is queryable as a first-class runtime system
- autonomous role-separated agent execution is live
- structured critic or evaluator output can trigger retries
- feedback changes future execution behavior automatically
- multi-model routing and fallback are explicit

## Pattern 10-B. Evidence-Backed Reflection

Reflection in Carbonet is not only "LLM self-critique".

It must also include:

- parity compare
- repair session open/apply
- verification run
- runtime freshness proof
- exact route response proof where relevant

In this repository, reflection is valid only when it leaves replayable evidence such as:

- runtime compare rows
- repair session records
- verification run records
- `jsonl` execution histories
- runtime proof logs and route checks

If a task claims Resonance improvement without new evidence, treat that as incomplete.

## Pattern 11. Main-Server Runtime Truth

The main server is the default runtime truth source.

Use it for:

- current runtime collection
- current rendered screen verification
- runtime-admin change visibility
- scheduler presence validation
- current-versus-target compare

Sub and idle nodes are rollout and health targets, not the default runtime truth source.

## Pattern 12. Chain And Matrix Governance

Every governed asset should appear in operator-facing matrices.

Required matrix families:

- project/runtime matrix
- menu/scenario matrix
- page/component matrix
- event/function/API/backend/DB matrix
- release-unit asset matrix
- runtime truth/rollout matrix
- delete/rollback blocker matrix
- parity/uniformity matrix

If an asset cannot be explained in one of these matrices, the asset is not governed enough.

## Pattern 12-A. Guided Continuation State

Repeated work should continue from the current governed step instead of restarting from zero.

Each active initiative should keep:

- `currentGuidedStep`
- `lastCompletedGuidedStep`
- `openBlockerStep`
- `nextRecommendedAiAction`
- `activeOwnershipLane`

This keeps operator flow, AI edits, repair, packaging, and deploy aligned over many turns.

## Pattern 12-B. Similar Work Retrieval And Lesson Application

Before implementing repeated page, API, DB, deployment, or orchestration work, the agent must retrieve similar completed or failed work and apply its lessons to the current task.

Required retrieval inputs:

- selected development pattern
- route, menu, screen family, module, and domain hints
- artifact path overlap
- API/entity/DB shape
- previous verification and failure evidence

Required task outputs:

- `referenceTasks`
- `referencePages`
- `lessonsApplied`
- `sourceArtifactsToOpen`
- `additionalChecks`

The retrieval result is not a substitute for source review. It is a routing map that tells the implementer which original files, docs, DB rows, and evidence logs must be reopened before editing.

If similar work shows a prior failure, the prevention check becomes mandatory for the current task. If no similar work is found, the task must record that absence and create a new lesson after verification.

## Pattern 13. Parity And Uniformity

Generated systems should be near-parity with current Carbonet runtime.

Required parity families:

- home
- signin
- join
- admin login
- list
- detail
- edit
- review
- popup-heavy admin
- file/export/approval screens

Required checks:

- menu-to-rendered-screen verification
- generated/current/baseline/patch compare
- parity score
- uniformity score
- selected-screen repair queue

## Pattern 14. Generated Asset Quality, Trace, And Audit

Every governed asset family should be generated and updated under one quality contract.

Required outcomes:

- uniform generation from approved profiles
- traceable provenance from requirement to runtime package
- auditable change history for human and AI edits
- no missing event, function, API, backend, or DB links
- no missing help, accessibility, security, or authority metadata
- no missing rollback or compare path

Required operator views:

- generation trace explorer
- chain and matrix explorer
- parity and uniformity review
- requirement coverage audit
- runtime package and rollback explorer

## Pattern 15. Security And Accessibility By Default

Do not add these after generation.

Every generated family must carry:

- authority
- classification
- CSRF when needed
- masking
- file access policy
- help anchors
- accessibility coverage
- audit trace

## Pattern 16. JSON Working Draft, DB Governance Truth

Use JSON for:

- drafts
- scaffold requests
- design bodies
- binding manifests

Use DB for:

- approvals
- publish lineage
- release-unit ownership
- search/indexable governance truth
- audit and rollback linkage

JSON revisions must be versioned, hashed, and publish-bound so they can be rolled back.

## Pattern 17. Monitoring, Cron, And Retention

Operational governance is part of product behavior.

Always include:

- log family governance
- scheduler registry
- main-server cron ownership
- retention class
- archive move history
- delete evidence
- post-deploy smoke

## Pattern 18. AI-Assisted But Contract-Driven

AI should not invent the system from prose every time.

Preferred order:

- choose project
- choose scenario
- choose theme and component set
- resolve bindings
- generate from normalized manifests
- use AI only for unresolved gaps or repair

## Pattern 19. Productization

Resonance is not just an internal tool.

Product-ready traits:

- installable module families
- version selection
- compatibility review
- support snapshot export
- baseline and patch history
- release-unit rollback
- operator-friendly GUI and diagnostics

## Pattern 20. Design-Output Productization

Design output is also a governed product artifact.

Resonance should be able to emit mature design outputs by family:

- requirements
- actor and authority
- process
- menu and route
- page design
- element design
- assembly and binding
- backend and DB
- test and acceptance
- help and operator guide
- scaffold-ready package

Those outputs must be printable, exportable, and bound to the same project and release lineage as the generated runtime.

## Pattern 21. Parity Closure Loop

Resonance should improve generated systems through a repeatable parity loop until the generated runtime is operationally indistinguishable from the governed target family.

Use this loop:

1. collect current runtime
2. compare generated vs current vs baseline vs patch target
3. measure parity and uniformity
4. open selected-screen or selected-element repair
5. regenerate only the affected governed assets
6. rebuild release unit
7. redeploy and rerun smoke and render checks
8. close only when parity blockers and unmanaged elements are zero

The loop is complete only when:

- no required scenario action is missing
- no unmanaged page or element family remains
- no blocking parity or uniformity drift remains
- runtime package behaves correctly on governed targets

## Pattern 22. Multi-Project Server-Set Delivery

Resonance should support many projects, each with its own governed server set, while still centralizing design, build, and release authority.

Each project server set should define:

- main web node
- sub web node when present
- idle-node participation policy
- DB node
- file/archive node policy
- scheduler execution owner
- smoke and rollback target set

The control plane should be able to:

- generate by project unit
- build by project unit
- deploy by project unit
- compare and repair by project unit
- roll back by project unit

without mixing runtime ownership across unrelated projects.

## Pattern 23. Performance-First Optional Stack Attachment

Advanced stacks should improve speed or visibility without bloating every runtime node.

Preferred direction:

- thin web runtime
- heavy support services on dedicated nodes
- installable and removable stack modules
- explicit memory budget and rollback path per stack

Good candidates:

- Nginx micro-cache
- Redis
- in-process cache such as Caffeine
- summary tables and snapshot views
- Prometheus/Grafana
- Loki or ELK by scale
- dedicated AI runner with prompt/result cache

## Build-Ready Checklist

Before implementation starts, confirm:

1. project-first ownership is fixed
2. scenario-first ownership is fixed
3. menu/page/feature/route links exist
4. component/theme/layout profiles are chosen
5. event/function/API/backend/DB chain is defined
6. help/security/accessibility are attached
7. control-plane versus runtime boundary is classified
8. release-unit and rollback target are defined
9. main-server runtime truth target is defined
10. matrix families can represent the feature

If one answer is missing, the feature family is not ready.
