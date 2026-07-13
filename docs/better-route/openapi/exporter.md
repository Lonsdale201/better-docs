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
