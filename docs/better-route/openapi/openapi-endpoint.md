---
title: openapi.json Endpoint
---

Use `OpenApiRouteRegistrar` to expose API docs as REST endpoint.

## Default permission (v0.3.0)

Since v0.3.0, the endpoint defaults to `current_user_can('manage_options')` — the doc is admin-only out of the box. To restore the v0.2.0 public default, pass an explicit `permissionCallback`:

```php
options: [
    'permissionCallback' => static fn (): bool => true,
]
```

## Minimal example

```php
use BetterRoute\OpenApi\OpenApiRouteRegistrar;

OpenApiRouteRegistrar::register(
    restNamespace: 'better-route/v1',
    contractsProvider: static fn (): array => OpenApiRouteRegistrar::contractsFromSources([
        $router,
        $articlesResource,
    ]),
    options: [
        'title' => 'better-route API',
        'version' => 'v1.1.0',
        'serverUrl' => '/wp-json',
        // 'permissionCallback' => static fn (): bool => true, // uncomment for public access
    ]
);
```

Endpoint result:

- `GET /wp-json/better-route/v1/openapi.json` (admin-only by default)

## contractsFromSources()

Accepts:

- `Router`
- `Resource`
- raw list of contract arrays

## Common mistakes

- invalid `restNamespace` format (must be `<vendor>/<version>`)
- non-callable `permissionCallback`
- `contractsProvider` not returning an array

## Validation checklist

- endpoint route meta uses `openapi.include=false`
- permission callback behavior matches exposure policy
- response document contains expected paths
