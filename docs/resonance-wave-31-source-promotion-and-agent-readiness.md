# Wave 31: Source Promotion And Agent Readiness

/opt/Resonance is the canonical framework workspace. The former /opt/projects/carbonet tree is archived under /opt/projects/_archive and is not required for normal builds.

Promoted from the archive:

- templates: project and adapter scaffolding references.
- data: version-control and runtime manifest seed data.
- ops: operational scripts and deployment helpers, merged without deleting canonical files.
- projects/project-template and projects/project-template-adapter: thin project and adapter templates.
- projects/legacy-samples/p003-* and projects/legacy-samples/p004-*: sample project runtimes and adapters kept outside the main Maven reactor.
- projects/carbonet-frontend/source: original frontend source, excluding node_modules, dist, and build outputs.
- modules/_legacy-candidates/*: common-module candidates that must be reviewed before joining the common reactor.

Promotion rule:

- modules/_legacy-candidates is read-only evidence until each module is classified as common, builder, ops, or retired.
- projects/legacy-samples is sample/project evidence and must not become shared common code by accident.
- 3B/local agent tasks should read this document first, then use deterministic file maps before opening broad source trees.

Next gate:

- Build canonical apps.
- Verify no active old /opt/projects/Resonance references remain.
- Promote only reviewed modules into modules/resonance-common, modules/resonance-builder, or modules/resonance-ops.
