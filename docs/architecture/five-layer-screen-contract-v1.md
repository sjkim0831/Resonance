# Five-layer screen contract v1

Resonance stores one canonical screen design and projects it into five
renderer-neutral layers. React, mobile, PDF and Tauri adapters consume this
projection; they must not redefine business fields or workflow rules.

1. `dataSchema`: fields, input/output, persistence, handoff and context keys.
2. `uiSchema`: sections, responsive rules and accessibility rules.
3. `actionSchema`: commands, API bindings and evidence requirements.
4. `processSchema`: process/step, states, entry/exit conditions and tests.
5. `permissionSchema`: responsible actor, action rules and security policy.

## Source-of-truth rule

`framework_professional_screen_contract` and
`framework_step_schema_set` remain the source of truth. The builder emits the
five layers as `contract_layers` in `catalog.json`. A renderer receives a
contract version and returns the version/hash it rendered so deployment can
detect stale assets.

## Change flow

Design update -> contract validation -> affected-contract diff -> incremental
generation -> renderer contract tests -> atomic asset publish -> runtime health
check. Unchanged screens are not regenerated.

## Pilot

`/emission/project/create` is the first acceptance screen. It is complete only
when required fields, process transition, actor permission, persistence,
responsive layout and test evidence all come from the same five-layer contract.
