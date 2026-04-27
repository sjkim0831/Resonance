# Resonance AI Framework Architecture

Generated on 2026-04-15 to define the current Carbonet interpretation of the Resonance AI and Agent layer.

## Overview

Resonance in Carbonet should be read as:

- `Agent + Memory + Tool + Feedback + Evolution`
- governed by the loop `Perceive -> Plan -> Act -> Observe -> Reflect -> Improve -> Repeat`

However, the repository is **not** yet at the full "self-evolving multi-agent OS" stage.

Current Carbonet status is:

- strong on `control-plane execution`, `runtime proof`, `repair flow`, and `operator-visible evidence`
- partial on `agent orchestration`, `workflow state`, and `human approval`
- weak on `semantic memory`, `preference learning`, `multi-LLM abstraction`, and `self-specialization`

So the practical reading for this repository is:

- **Current Resonance** = `Codex execution + runtime control + parity compare + repair + verification evidence`
- **Target Resonance** = full multi-agent, memory-augmented, self-improving control plane

## Current Carbonet Implementation Shape

Today the implemented backbone is closer to a **control-plane-first Resonance MVP** than a generalized AI agent operating system.

Current concrete surfaces already present in the repository:

- `Codex Execution Console`
  - `/admin/system/codex-request`
- `SR Workbench execution lifecycle`
  - prepare, plan, execute, direct execute, reissue, rollback
- `Runtime Control Plane`
  - parity compare, repair open, repair apply, verification run
- `Freshness proof`
  - `build-restart-18000.sh`
  - `codex-verify-18000-freshness.sh`
- `File-backed episodic logs`
  - `jsonl` stores under `/tmp/carbonet-resonance-*.jsonl`

This means Carbonet already has:

- execution orchestration
- runtime evidence capture
- repair/recheck workflow
- operator-facing control-plane pages

It does **not** yet fully have:

- autonomous Planner/Researcher/Executor/Critic team execution
- semantic memory or RAG over governed docs/code/runtime evidence
- structured social memory and preference learning
- dynamic multi-model routing and fallback
- self-generated workflow evolution

## Capability Matrix

### 1. Agent Orchestration

Target capability:

- multi-agent teams
- task decomposition
- delegation
- graph or tree execution

Carbonet current state:

- `PARTIAL`
- implemented more as operator-driven execution lanes than autonomous agent teams
- strongest current surfaces are `codex-request` and `sr-workbench`

### 2. Long-term Memory System

Target capability:

- episodic
- semantic
- procedural
- social memory

Carbonet current state:

- `PARTIAL`
- episodic execution logs exist through `jsonl` stores and runner histories
- procedural memory exists as skills and architecture docs
- semantic and social memory are not yet first-class runtime systems

### 3. Tool & Environment Layer

Target capability:

- tool registry
- function routing
- CLI/browser/code execution
- DB/Git/cloud integration

Carbonet current state:

- `PARTIAL`
- strong on CLI, package, deploy, restart, compare, repair, verification scripts
- weak on general browser tooling, autonomous code sandboxing, and reusable tool registry abstractions

### 4. Reflection & Self-Improvement Engine

Target capability:

- self-critique
- execution review
- failure analysis
- prompt/strategy improvement

Carbonet current state:

- `PARTIAL`
- parity compare, repair apply, and re-verification form a real reflection loop
- generic AI critic/evaluator/prompt evolution loop is not yet a first-class subsystem

### 5. Human-AI Feedback Loop

Target capability:

- human approval gates
- feedback ingestion
- preference learning
- reinforcement signals

Carbonet current state:

- `PARTIAL`
- operator prepare/approve/execute flows exist
- explicit learned preference model and correction reuse are still missing

### 6. Workflow & Pipeline Engine

Target capability:

- DAG execution
- event-driven runs
- state transitions
- retries and recovery

Carbonet current state:

- `STRONGEST CURRENT AREA`
- project pipeline, verification run, repair flow, and execution lifecycle are already structured workflows

### 7. Observability & Logging

Target capability:

- agent decision logs
- tool call traces
- token/cost tracking
- replayability

Carbonet current state:

- `STRONG`
- runtime proof, verification evidence, execution history, trace context, and replayable file-backed histories already exist
- token and model-cost governance remain incomplete

### 8. Prompt & Policy Management

Target capability:

- prompt versioning
- policy rules
- guardrails
- A/B testing

Carbonet current state:

- `PARTIAL`
- policy and workflow rules exist in docs and skills
- prompt versioning and prompt experiment management are not yet formalized

### 9. Model Abstraction Layer

Target capability:

- multi-LLM routing
- fallback
- latency/cost optimization
- local/cloud mix

Carbonet current state:

- `WEAK`
- current implementation is Codex-runner-oriented, not yet a governed multi-model router

### 10. Evolution Engine

Target capability:

- self-specialization
- self-generated workflows
- architecture adaptation

Carbonet current state:

- `NOT YET IMPLEMENTED`

## Minimum Carbonet Resonance MVP

For this repository, a realistic MVP should be defined as:

1. governed execution console
2. explicit prepare/plan/execute lifecycle
3. runtime parity compare and repair loop
4. verification proof against `:18000`
5. episodic execution memory
6. operator approval and audit evidence

That is the minimum practical Carbonet form of Resonance today.

## Required Next Upgrades

To move from the current control-plane MVP to a fuller Resonance framework, the next required upgrades are:

1. structured Planner / Researcher / Executor / Critic role separation
2. semantic memory over docs, code, runtime evidence, and operator actions
3. structured critic output that can trigger retries automatically
4. reusable tool registry abstraction instead of page- or service-local execution paths
5. model abstraction and fallback policy
6. feedback ingestion that updates future execution behavior

## Integration with Resonance Builder

The current repository already uses the Resonance control-plane direction to:

1. drive governed execution through `codex-request`
2. connect prepare/plan/execute workflows to SR and operator surfaces
3. compare runtime state against builder or release expectations
4. prove runtime freshness and route-level evidence on `:18000`

The future state should extend that into:

1. requirement understanding
2. scenario generation
3. component-aware page composition
4. full-stack code generation
5. execution review
6. memory-backed improvement on subsequent runs
