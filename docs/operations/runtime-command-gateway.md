# Runtime Command Gateway

Runtime Command Gateway is the standard path for project screen actions that need transaction handling but should not require a new Java controller per page.

## Endpoint

```http
POST /admin/system/runtime-command/execute
POST /en/admin/system/runtime-command/execute
```

Request:

```json
{
  "commandId": "admin.menu.updatePage",
  "params": {
    "code": "A0060101",
    "codeNm": "메뉴 관리",
    "codeDc": "Menu Management",
    "menuUrl": "/admin/system/menu",
    "menuIcon": "menu",
    "useAt": "Y"
  }
}
```

Response:

```json
{
  "success": true,
  "commandId": "admin.menu.updatePage",
  "transaction": "committed",
  "data": {}
}
```

## Built-in Commands

- `admin.menu.updatePage`
- `admin.menu.toggleExposure`
- `admin.menu.updateDependentScreen`

## Rule

Add Java only for stable runtime capabilities. Page-specific actions should be registered as safe runtime commands and then called through this endpoint. Each command runs inside one transaction boundary.

Unsupported command IDs are rejected by default. Do not add raw SQL execution without command allow-list, parameter validation, authorization, and audit logging.
