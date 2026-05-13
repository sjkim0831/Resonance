# KRDS Frontend Policy

KRDS is the primary design reference for public home screens. Home screens should follow KRDS layout, header, navigation, button hierarchy, typography, responsive spacing, footer, accessibility, and component behavior closely.

Admin screens may be designed freely, but must remain KRDS-compatible. Use KRDS tokens, typography, focus outlines, form controls, table patterns, tabs, pagination, badges, modals, and restrained dashboard composition.

Local reference path:

`/opt/reference/krds-uiux-main`

Key implementation rule:

Before implementing a KRDS-influenced frontend screen, inspect relevant files under `html/code`, `resources/scss/component`, and `tokens/transformed_tokens.json`.

Use exact KRDS classes and assets when feasible. When adapting to React, Vue, Tailwind, or another local stack, preserve visual hierarchy, states, accessibility behavior, and token values.
