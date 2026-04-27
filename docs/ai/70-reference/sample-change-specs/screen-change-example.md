# Sample Screen Change Spec

Use compact structured requests so AI can apply changes more safely.

Example:

- target screen: `COMMON-006 /join/step1`
- actor: `USER`
- locale scope: `ko,en`
- UI change: `change member-type card order and add help text`
- event change: `keep existing next-step handler`
- API change: `none`
- DB change: `none`
- risk notes: `must preserve session-backed membershipType`
