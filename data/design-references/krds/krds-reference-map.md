# KRDS Reference Map

Local source: `/opt/reference/krds-uiux-main`

Use this map to choose the smallest useful KRDS references for a frontend task.

## Core Assets

- `resources/cdn/krds.min.css`: bundled KRDS CSS.
- `resources/cdn/krds.min.js`: bundled KRDS interactions.
- `resources/fonts/PretendardGOV-*.woff2`: KRDS font assets.
- `tokens/transformed_tokens.json`: token groups: `primitive`, `mode-light`, `mode-high-contrast`, `responsive-pc`, `responsive-mobile`, `semantic`.
- `resources/scss/common/_root.scss`: generated root CSS variables, focus outline variables, content sizing, responsive mobile padding.

## Home Screen References

- `html/code/header.html`
- `html/code/main_menu_pc.html`
- `html/code/main_menu_mobile.html`
- `html/code/masthead.html`
- `html/code/breadcrumb.html`
- `html/code/carousel_banner.html`
- `html/code/footer.html`
- `resources/scss/component/_header.scss`
- `resources/scss/component/_main_menu.scss`
- `resources/scss/component/_masthead.scss`
- `resources/scss/component/_footer.scss`

Home screens should stay close to KRDS public-service patterns and accessibility behaviors.

## Admin Screen References

- `html/code/side_navigation.html`
- `html/code/table.html`
- `html/code/structured_list_table.html`
- `html/code/pagination.html`
- `html/code/tab.html`
- `html/code/modal.html`
- `html/code/badge.html`
- `html/code/tag.html`
- `resources/scss/component/_side_navigation.scss`
- `resources/scss/component/_table.scss`
- `resources/scss/component/_pagination.scss`
- `resources/scss/component/_tab.scss`
- `resources/scss/component/_modal.scss`

Admin screens may be original layouts, but should keep KRDS typography, controls, focus states, and restrained public-service tone.

## Form References

- `html/code/text_input.html`
- `html/code/text_input_state.html`
- `html/code/text_input_icon.html`
- `html/code/select.html`
- `html/code/select_state.html`
- `html/code/checkbox.html`
- `html/code/radio_button.html`
- `html/code/date_input.html`
- `html/code/file_upload.html`
- `resources/scss/component/_input.scss`
- `resources/scss/component/_select.scss`
- `resources/scss/component/_form_check.scss`
- `resources/scss/component/_file_upload.scss`

## Interaction And Accessibility References

- `html/code/skip_link.html`
- `html/code/accordion.html`
- `html/code/disclosure.html`
- `html/code/tooltip.html`
- `html/code/critical_alerts.html`
- `resources/scss/component/_skip_link.scss`
- `resources/scss/component/_accordion.scss`
- `resources/scss/component/_disclosure.scss`
- `resources/scss/component/_tooltip.scss`
- `resources/scss/component/_critical_alerts.scss`

Always preserve keyboard, focus, disabled, hover, pressed, and high-contrast states when adapting KRDS patterns.
