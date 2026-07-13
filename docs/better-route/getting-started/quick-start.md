---
title: Quick Start
---

:::tip Working with an AI agent?
All better-route agent skills live in one place: **[Lonsdale201/wp-agent-skills → better-route](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route)** — 23 task-scoped skills (routing, auth, write safety, CORS, OpenAPI, WooCommerce, …). See [AI Agent Skills](../agents) for the highlights.
:::

<a className="button button--primary" href="https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route" target="_blank" rel="noopener noreferrer">Browse the agent skills on GitHub →</a>

## Minimal router

```php
use BetterRoute\Router\Router;

add_action('rest_api_init', function (): void {
    $router = Router::make('better-route', 'v1');

    $router->get('/ping', fn (): array => ['pong' => true])
        ->meta([
            'operationId' => 'systemPing',
            'tags' => ['System'],
        ])
        ->publicRoute();

    $router->register();
});
```

Result:

- namespace: `better-route/v1`
- endpoint: `GET /wp-json/better-route/v1/ping`

Every raw `Router` route — `GET` and `OPTIONS` included since v1.1.0 — denies by default until you declare intent with `->permission(...)`, `->protectedByMiddleware(...)`, or `->publicRoute()`.

## Minimal resource (CPT)

```php
use BetterRoute\Resource\Resource;

add_action('rest_api_init', function (): void {
    Resource::make('articles')
        ->restNamespace('better-route/v1')
        ->sourceCpt('post')
        ->allow(['list', 'get'])
        ->fields(['id', 'title', 'slug', 'date'])
        ->filters(['status'])
        ->sort(['date', 'id'])
        ->register();
});
```

## Minimal OpenAPI export endpoint

```php
use BetterRoute\OpenApi\OpenApiRouteRegistrar;

OpenApiRouteRegistrar::register(
    restNamespace: 'better-route/v1',
    contractsProvider: static fn (): array => [
        // typically merge router/resource contracts here
    ],
    options: [
        'title' => 'better-route API',
        'version' => 'v1.1.0',
        'serverUrl' => '/wp-json',
        // Override the admin-only default (introduced in v0.3.0) to expose the doc:
        // 'permissionCallback' => static fn (): bool => true,
    ]
);
```

The `openapi.json` endpoint is admin-only (`manage_options`) by default since v0.3.0. Pass `permissionCallback` if you need a different policy.

## Common mistakes

- Forgetting `->register()` on router/resource (fails loudly outside `rest_api_init` since v1.1.0)
- Missing route intent — every method denies by default since v1.1.0; add `->publicRoute()`, `->permission(...)`, or `->protectedByMiddleware(...)`
- Defining `restNamespace` without vendor/version format (`vendor/v1`)
- Assuming middleware auth replaces `permission_callback` (it does not)

## Validation checklist

- endpoint responds under `/wp-json/...`
- error payload includes `requestId`
- unknown query params fail with `400` on resource list routes
