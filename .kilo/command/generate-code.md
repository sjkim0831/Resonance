---
description: Generate code using AI (M2.7 + 16 NVIDIA keys)
agent: ai-code-generator
---

Generate code for Resonance framework using AI.

Usage:
- @generate-code --type adapter --common hermes-core --project carbonet
- @generate-code --type module --name UserService --entity User
- @generate-code --type service --name PaymentService --lang python

Options:
- type: adapter|module|service
- common: Common module name
- project: Target project name
- name: Component name
- entity: Data entity
- lang: Language (python|typescript|java)
