---
title: Table Resource
---

Table resources map custom DB tables through `WordPressTableRepository`/`WpdbAdapter`.

## Deny-by-default (v0.3.0)

**Table resources reject every action — including `list` and `get` — until a `policy()` is configured.** This is the most important behavioral change in v0.3.0 for table-backed endpoints. Use a `ResourcePolicy` preset or supply an explicit `permissions` array.

## Minimal example

```php
use BetterRoute\Resource\Resource;
use BetterRoute\Resource\ResourcePolicy;

Resource::make('raw-articles')
    ->restNamespace('better-route/v1')
    ->sourceTable('ai_raw_articles', 'id')
    ->allow(['list', 'get', 'create', 'update', 'delete'])
    ->fields(['id', 'source', 'title', 'lang', 'published', 'created_at', 'updated_at'])
    ->filters(['source', 'lang', 'published'])
    ->filterSchema([
        'source' => 'string',
        'lang' => 'string',
        'published' => 'bool',
    ])
    ->sort(['created_at', 'id'])
    ->maxPerPage(100)
    ->maxOffset(5000)
    ->policy(ResourcePolicy::adminOnly('manage_options'))
    ->register();
```

## SQL safety model

`WpdbAdapter` enforces:

- identifier validation for table/field/sort names
- prepared statements for values
- prefixed table resolution via `$wpdb->prefix`
- *(v0.3.0)* cross-database table names (containing `.`) are rejected
- *(v0.3.0)* structured (array/object) write payloads are rejected at the storage boundary
- *(v1.1.0)* `null` payload values are written as **real SQL `NULL`** on insert and update (previously they could be coerced to a string placeholder)

## Deterministic ordering (v1.1.0)

- With no `sort` requested, lists are ordered by the **primary key** (previously unordered — MySQL could return rows in any order).
- With an explicit sort field, the primary key is appended as a **tie-breaker** in the same direction, so rows with equal sort values keep a stable position across pages.

## Scenario: ingestion rows with typed filters

- Declare `source_id` as `int`, `published` as `bool`
- Requests like `?source_id=12&published=true` are type-coerced before repository call

## Common mistakes

- Missing `fields()` (required for table resources)
- Using invalid SQL identifiers in field names
- Assuming unknown query params are ignored
- *(v0.3.0)* skipping `policy()` — every action returns `403` without an explicit policy
- *(v0.3.0)* attempting to reference a foreign database via `other_db.table` — rejected at the adapter layer

## Validation checklist

- list queries use LIMIT/OFFSET with prepared args
- invalid identifiers fail early
- create/update payload keys outside allowlist return `400 validation_failed`
