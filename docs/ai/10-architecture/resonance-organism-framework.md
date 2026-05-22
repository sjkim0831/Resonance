# Resonance Organism Framework

Generated on 2026-05-19 from the artificial body AI system reference image.

## Purpose

Resonance now treats operations as a 9-layer organism:

- `Agent + Memory + Tool + Feedback + Evolution`
- governed by `Perceive -> Plan -> Act -> Observe -> Reflect -> Improve -> Repeat`
- constrained by autonomy, adaptability, continuity, and ethics

This is not a claim that every target capability is complete. It is the canonical control-plane map for deciding where a signal, action, memory, team, or approval rule belongs.

## Runtime Contract

The file-backed contract is:

- `/opt/Resonance/data/ai-runtime/organism-framework-layers.json`

The ops web reads that file for `/api/framework`, so the visible framework panel follows the repository asset instead of a hardcoded screen copy.

## Layers

| Order | Layer | Domain | Current Resonance Meaning |
| --- | --- | --- | --- |
| 1 | 영혼 계층 | 인지 / 자아 / 가치 | mission, policy, ethics, project boundaries |
| 2 | 대뇌 계층 | 사고 / 추론 / 계획 | planner, coder, specialist model routing, strategy memory |
| 3 | 감각 계층 | 인식 / 감지 | health, metrics, logs, Kubernetes events, tunnel probes |
| 4 | 자율 신경 계층 | 반사 / 자동 제어 | guarded self-healing, restart, rollback, pressure response |
| 5 | 행동 계층 | 운동 / 조작 | build, deploy, rollout, traffic switch, command execution |
| 6 | 기억 계층 | 저장 / 학습 | incident memory, rollout timeline, job history, lessons |
| 7 | 면역 계층 | 보안 / 보호 | approval gates, audit trail, destructive-action guard, token hardening |
| 8 | 혈관 계층 | 전력 / 데이터 흐름 | network, service mesh, DB connection, file/artifact flow |
| 9 | 생명 유지 계층 | 환경 적응 | capacity, GPU/CPU/RAM/disk, housekeeper, standby runtime |

## Communication Model

- Event bus: task, failure, deploy, model, and verification events move across layers.
- Shared memory: incident memory, rollout timeline, job history, and pattern cards are reused as operating memory.
- Signal transfer: health, Kubernetes, DB, tunnel, and capacity signals become layer status.
- Priority scheduling: security, outage, deployment, and capacity pressure are promoted ahead of ordinary work.

## Operating Rule

Execution surfaces stay centralized. The main ops page owns active commands such as build/redeploy, while status pages show evidence, timelines, and logs. This keeps the motor layer visible without scattering high-risk controls across monitoring screens.

## Maturity Notes

Strong current surfaces:

- runtime evidence capture
- build/deploy execution
- rollout timeline
- health and Kubernetes sensing
- operator-visible control plane

Partial or target surfaces:

- semantic memory
- social/preference memory
- generalized model routing
- self-specializing agent roles
- autonomous workflow evolution

Those target surfaces must stay labeled as partial until they are backed by runtime evidence and repeatable verification.
