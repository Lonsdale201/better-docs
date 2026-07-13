---
title: Common Scenarios
---

## Scenario 1: Public content read API

Goal: expose posts read-only for frontend app.

```php
Resource::make('articles')
    ->restNamespace('better-route/v1')
    ->sourceCpt('post')
    ->allow(['list', 'get'])
    ->fields(['id', 'title', 'slug', 'excerpt', 'date'])
    ->filters(['after', 'before'])
    ->filterSchema(['after' => 'date', 'before' => 'date'])
    ->sort(['date', 'id'])
    ->policy(['public' => true])
    ->register();
```

Notes:

- strict query parsing keeps contract stable
- default status visibility keeps drafts out

## Scenario 2: Protected write API with idempotency + optimistic lock

Goal: safe concurrent updates from external writer.

```php
$router->middleware([
    new IdempotencyMiddleware(new TransientIdempotencyStore(), ttlSeconds: 300, requireKey: true),
    new OptimisticLockMiddleware(new CallbackOptimisticLockVersionResolver($resolveVersion)),
]);

$router->patch('/orders/(?P<id>\d+)', $updateOrder)
    ->permission(static fn (): bool => current_user_can('edit_posts'));
```

Expected failures:

- missing idempotency key -> `400 idempotency_key_required`
- malformed/over-length idempotency key -> `400 idempotency_key_invalid` *(v1.1.0)*
- stale version -> `412 optimistic_lock_failed`
- missing expected version (when required) -> `428 precondition_required`

*(v1.1.0)* Version resolution and the write run inside a per-resource MySQL critical section, so cooperating Better Route writers cannot race between the version check and the write. Writers outside this protocol are not serialized — see [Optimistic locking](../write-safety/optimistic-locking).

## Scenario 3: OpenAPI endpoint from mixed sources

Goal: one document from router + CPT + table resources.

```php
OpenApiRouteRegistrar::register(
    restNamespace: 'better-route/v1',
    contractsProvider: static fn (): array => OpenApiRouteRegistrar::contractsFromSources([
        $router,
        $articlesResource,
        $rawArticlesResource,
    ]),
    options: ['title' => 'Better Route API', 'version' => 'v1.1.0']
);
```

## Scenario 4: Metrics + audit baseline

Goal: produce operational signals for every request.

```php
$router->middleware([
    new MetricsMiddleware(new PrometheusMetricSink()),
    new AuditMiddleware(new ErrorLogAuditLogger()),
]);
```

Validation:

- counters and durations are emitted
- audit event has requestId + statusCode + outcome
