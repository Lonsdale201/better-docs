---
title: Resource API Reference
---

## Constructor

- `Resource::make(string $name): Resource`

## Source selection

- `restNamespace(string $restNamespace)`
- `sourceCpt(string $postType)`
- `sourceTable(string $table, string $primaryKey = 'id')`

## Contract shape

- `allow(array $actions)`
- `fields(array $fields)`
- `filters(array $filters)`
- `filterSchema(array $schema)`
- `sort(array $sort)`
- `policy(array $policy)`
- `writeSchema(array $schema)` *(v0.3.0)* — alias of `payloadSchema()`
- `payloadSchema(array $schema)` *(v0.3.0)* — write validation, coercion, sanitization
- `fieldPolicy(array $policy)` *(v0.3.0)* — per-field write authorization
- `deleteMode(string $mode)` *(v0.3.0)* — CPT only; `'force'` (default) or `'trash'`

## Pagination and envelope

- `defaultPerPage(int $defaultPerPage)`
- `maxPerPage(int $maxPerPage)`
- `maxOffset(int $maxOffset)`
- `uniformEnvelope(bool $enabled = true)`

## CPT-specific controls

- `cptVisibleStatuses(array $statuses)`
- `cptVisibilityPolicy(callable $policy)` — *(v1.1.0)* the per-item callback is evaluated against every matching repository page so `total`/pagination stay truthful; for large datasets prefer a query-level filter or repository condition. See [CPT Resource](../resources/cpt-resource).

## Repository injection

- `usingCptRepository(CptRepositoryInterface $repository)`
- `usingTableRepository(TableRepositoryInterface $repository)`

## Registration and contracts

- `register(?DispatcherInterface $dispatcher = null): void`
- `contracts(bool $openApiOnly = false): array`
- `descriptor(): array`
- `name(): string`

## Policy keys

Supported policy patterns:

- `public => true`
- `permissionCallback => callable`
- `permissions => ['list' => true|false|string|array|callable, '*' => ...]`
- `scopes => ['content:read', ...]`

## ResourcePolicy presets (v0.3.0)

`BetterRoute\Resource\ResourcePolicy` returns ready-to-pass policy arrays:

- `ResourcePolicy::adminOnly(string $cap = 'manage_options'): array`
- `ResourcePolicy::publicReadPrivateWrite(string|list<string> $writeCap = 'manage_options'): array`
- `ResourcePolicy::capabilities(array $permissions): array`
- `ResourcePolicy::callbacks(array $callbacks): array`

```php
$resource->policy(ResourcePolicy::publicReadPrivateWrite('edit_posts'));
```

## Table reads are deny-by-default (v0.3.0)

Custom-table resources (`sourceTable()`) reject every action — including `list` and `get` — until a policy is configured. Use a `ResourcePolicy` preset or pass an explicit `permissions` array. CPT resources keep WordPress visibility for reads.

## Write schema rule keys (v0.3.0)

`writeSchema()` / `payloadSchema()` accept a map of field rules:

- `type`: `'int'|'integer'|'float'|'number'|'bool'|'boolean'|'string'|'date'|'email'|'url'|'enum'|'array'|'object'|'mixed'`
- `required`: `true` (enforced on `create`)
- `nullable`: `true`
- `min` / `max` (numeric)
- `minLength` / `maxLength` (string)
- `regex` (string; preg pattern)
- `enum`: `['values' => [...]]`
- `sanitize`: `'text'|'email'|'key'|'url'|callable`

Validation failures return `400 validation_failed` with `details.fieldErrors` mapping each invalid field to its messages.

## Common example

```php
Resource::make('raw-articles')
    ->restNamespace('better-route/v1')
    ->sourceTable('ai_raw_articles', 'id')
    ->allow(['list', 'get'])
    ->fields(['id', 'title', 'source'])
    ->filters(['source'])
    ->sort(['id'])
    ->policy(['permissions' => ['list' => true, 'get' => true]])
    ->register();
```
