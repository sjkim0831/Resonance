# Migration Rules

Use this file to constrain DB changes for AI-assisted work.

Recommended rules:

- generate migration scripts instead of direct DB edits
- require rollback plan for schema changes
- flag destructive operations
- identify sensitive tables
- require naming checks against project conventions
