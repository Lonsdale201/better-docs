---
title: OpenAPI Exporter
---

`BetterRoute\OpenApi\OpenApiExporter::export(array $contracts, array $options = []): array`

## Minimal example

```php
use BetterRoute\OpenApi\OpenApiExporter;

$contracts = array_merge(
    $router->contracts(true),
    $resource->contracts(true)
);

$document = (new OpenApiExporter())->export($contracts, [
    'title' => 'better-route API',
    'version' => 'v1.1.0',
    'description' => 'Contract-first API',
    'serverUrl' => '/wp-json',
    'openapiVersion' => '3.1.0',
    'strictSchemas' => true, // v0.3.0; throws on unknown $ref components
    'components' => [
        'schemas' => [
            'Article' => ['type' => 'object'],
        ],
    ],
]);
```

## Export options

- `title`
- `version`
- `description`
- `serverUrl`
- `openapiVersion`
- `includeExcluded`
- `components`
- `strictSchemas` *(v0.3.0)* — when `true`, missing component references throw `InvalidArgumentException` instead of being substituted with `{ type: 'object', additionalProperties: true }`

## Important behavior

Since 1.1.2:

- Duplicate method/path, equivalent templates with different parameter names and duplicate
  operation IDs throw. PUT keeps Update; PATCH uses Patch. Woo operationIdPrefix supports
  multiple registrations.
- Balanced named captures become path parameters; unsupported regex outside captures fails.
  Escape literal dots in WordPress route patterns. Exclude unrepresentable PCRE routes.
- Query/path/cookie names are case-sensitive; headers merge case-insensitively. Explicit
  parameters preserve style/explode/allowReserved/examples. WP boolean exclusive bounds
  convert recursively into numeric JSON Schema bounds. Custom schemas use 2020-12 syntax.
- summary, description and deprecated are standard operation fields. Inline HEAD/204/304
  responses omit content. Referenced response definitions remain application-owned.
- Strict mode follows nested local JSON pointers, not just top-level schema names. Default
  compatibility mode only fills missing direct schema references with placeholders. External
  references/anchors are not resolved; full validation remains required.
- Malformed security requirements and undefined schemes throw. Omission inherits global
  security; `[]` makes an operation public, `[{}]` adds an anonymous alternative. Local scheme
  aliases resolve and non-OAuth role arrays are legal in OpenAPI 3.1. Metadata enforces no auth.

Validate serialized output, including the application's custom components:

```bash
php tests/openapi/export.php /tmp/better-route-openapi.json
python -m pip install -r tests/openapi/requirements.txt
python tests/openapi/validate.py /tmp/better-route-openapi.json
```

The library's CI validates four document variants and native synthetic WP/Woo responses;
it does not prove arbitrary consumer schemas or handlers. Runtime PHP minimum stays 8.1.

- Path regex placeholders `(?P<id>...)` convert to `{id}`
- Path params are forced `required=true`
- Unsupported HTTP methods are skipped
- `default` response references `#/components/responses/ErrorResponse`
- *(v1.1.0)* Executable route `args` are exported as `path`/`query` parameters automatically; explicit `meta.parameters` entries override derived ones with the same `name` + `in`
- *(v1.1.0)* `OPTIONS` operations emit a `204` success response without content; `HEAD` responses carry no content schema
- *(v1.1.0)* Custom `meta.responses` replace the generated default for the same status code (previously the default won)

## Common mistakes

- forgetting `openapi.include=false` for internal ops
- using invalid `parameters` structure
- referencing non-existent schemas

## Validation checklist

- generated document has `openapi`, `info`, `servers`, `paths`, `components`
- expected operations include `x-scopes` and `x-better-route` extensions
- POST routes emit `201` success response
