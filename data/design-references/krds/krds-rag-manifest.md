# KRDS RAG Manifest

Purpose: RAG-ready guide for registering KRDS as the design reference source for frontend generation.

Original source path:

`/opt/reference/krds-uiux-main`

Windows UNC path:

`\\wsl.localhost\Ubuntu-24.04\opt\reference\krds-uiux-main`

Recommended metadata:

- `source_system`: `KRDS`
- `source_path`: `/opt/reference/krds-uiux-main`
- `domain`: `frontend-design-system`
- `language`: `ko`
- `usage`: `home-screen-strict-reference, admin-screen-theme-reference`

Recommended ingest set:

- `/opt/reference/krds-uiux-main/README.md`
- `/opt/reference/krds-uiux-main/tokens/transformed_tokens.json`
- `/opt/reference/krds-uiux-main/tokens/figma_token.json`
- `/opt/reference/krds-uiux-main/resources/scss/common/_root.scss`
- `/opt/reference/krds-uiux-main/resources/scss/common/_variables_for_code.scss`
- `/opt/reference/krds-uiux-main/resources/scss/component/*.scss`
- `/opt/reference/krds-uiux-main/html/code/*.html`

Exclude from text RAG unless the pipeline supports binary assets:

- `/opt/reference/krds-uiux-main/resources/fonts/*`
- `*:Zone.Identifier`

Chunking recommendation:

- Markdown and HTML examples: split by heading or component file.
- SCSS: one component file per document, or split at top-level mixins/classes.
- JSON tokens: split by top-level group: `primitive`, `mode-light`, `mode-high-contrast`, `responsive-pc`, `responsive-mobile`, `semantic`.

Retrieval policy:

- Home screen requests should retrieve header, main menu, masthead, button, form, footer, and token documents.
- Admin requests should retrieve side navigation, table, pagination, tab, modal, badge, input, select, and token documents.
- Always include exact source path metadata in generated answers or implementation notes when KRDS influenced a component.
