---
title: Resources Overview
---

`BetterRoute\Resource\Resource` provides a DSL to register CRUD-style endpoints for CPTs or custom tables.

## When to use

- You want list/get/create/update/delete with strict contract controls
- You need predictable fields/filters/sort behavior
- You want OpenAPI-ready metadata from the same declaration

## Minimal example

```php
use BetterRoute\Resource\Resource;

Resource::make('articles')
    ->restNamespace('better-route/v1')
    ->sourceCpt('post')
    ->allow(['list', 'get', 'create', 'update', 'delete'])
    ->fields(['id', 'title', 'slug', 'status'])
    ->filters(['status'])
    ->filterSchema(['status' => ['type' => 'enum', 'values' => ['publish', 'draft']]])
    ->sort(['date', 'id'])
    ->register();
```

## Supported actions

- `list`
- `get`
- `create`
- `update` (both `PUT` and `PATCH`)
- `delete`

## Core guardrails

- unknown query params return `400 validation_failed`
- field allowlist enforced for projections and writes
- pagination limits enforced (`defaultPerPage`, `maxPerPage`, `maxOffset`)
- *(v0.3.0)* table resources are deny-by-default — configure a `policy()` (or `ResourcePolicy` preset) before they accept any traffic
- *(v0.3.0)* `id` is always read from URL route params first; query/body `id` is only consulted as a fallback
- *(v1.1.0)* CPT reads fail closed on missing/private/password-protected visibility data, and invariant `WP_Query` arguments cannot be overridden through declared filters — see [CPT Resource](cpt-resource)
- *(v1.1.0)* list ordering is deterministic: a primary-key/`ID` tie-breaker is always appended — see [Query Contract](query-contract)

## Write validation (v0.3.0)

Use `writeSchema()` (alias `payloadSchema()`) to validate, coerce, and sanitize incoming POST/PUT/PATCH bodies. Combine with `fieldPolicy()` for per-field write authorization. See [Resource API Reference](../reference/resource-api) for the full rule set.

```php
Resource::make('books')
    ->sourceCpt('book')
    ->writeSchema([
        'title' => ['type' => 'string', 'required' => true, 'maxLength' => 200, 'sanitize' => 'text'],
        'price' => ['type' => 'float', 'min' => 0],
    ])
    ->fieldPolicy([
        'featured' => static fn () => current_user_can('manage_options'),
    ]);
```

## Common mistakes

- Missing `fields()` on table resources
- Invalid `restNamespace` format
- Assuming hidden CPT statuses are still retrievable via `get`

## Validation checklist

- routes registered for all requested actions
- contracts available via `contracts()`
- list responses include `meta.page`, `meta.perPage`, `meta.total`
