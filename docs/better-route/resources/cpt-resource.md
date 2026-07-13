---
title: CPT Resource
---

CPT resources map a post type to REST endpoints with policy and visibility controls.

## Minimal example

```php
use BetterRoute\Resource\Resource;
use BetterRoute\Resource\ResourcePolicy;

Resource::make('articles')
    ->restNamespace('better-route/v1')
    ->sourceCpt('post')
    ->allow(['list', 'get', 'create', 'update', 'delete'])
    ->fields(['id', 'title', 'slug', 'excerpt', 'content', 'date', 'status', 'author'])
    ->filters(['status', 'author', 'after', 'before'])
    ->filterSchema([
        'status' => ['type' => 'enum', 'values' => ['publish', 'draft', 'private']],
        'author' => 'int',
        'after' => 'date',
        'before' => 'date',
    ])
    ->cptVisibleStatuses(['publish'])
    ->deleteMode('trash') // v0.3.0; 'force' (default) or 'trash'
    ->policy(ResourcePolicy::publicReadPrivateWrite('edit_posts'))
    ->register();
```

The raw `policy([...])` form is still supported when finer-grained control is needed. `ResourcePolicy` presets cover most cases.

## Visibility model

- Default visible statuses: `['publish']`
- If `status` filter is omitted, default status filter is applied
- `cptVisibilityPolicy(callable)` can further restrict row-level visibility

### Fail-closed visibility (v1.1.0)

Reads now **fail closed** when visibility data is missing or restricted:

- an item with a missing/unreadable `status` is hidden (previously an absent status could slip through)
- posts of a non-publicly-viewable post type are hidden
- **password-protected posts are hidden** unless the current user passes `current_user_can('read_post', $id)`; list queries additionally exclude them at the query level (`has_password => false`)

### Custom visibility callbacks and pagination (v1.1.0)

A `cptVisibilityPolicy()` callback is arbitrary PHP — it cannot be pushed down into `WP_Query`. To keep `meta.total` and pagination truthful, the Resource layer **scans all matching repository pages**, applies the callback item by item, and only then slices the requested page. Totals and page counts describe the *visible* result set, but the cost is proportional to the full match count — for large datasets, express visibility as a query-level filter (declared `filters()` / repository conditions) instead of a per-item callback.

### Reserved query arguments (v1.1.0)

Invariant `WP_Query` arguments can no longer be overridden through declared filters. Registering any of `post_type`, `posts_per_page`, `paged`, `no_found_rows`, `fields`, `orderby`, `order`, `has_password`, `suppress_filters`, `perm` as a filter name throws an `InvalidArgumentException` at registration time.

### Deterministic ordering (v1.1.0)

List ordering always appends an `ID` tie-breaker (default sort: `date`), so rows with identical sort values no longer swap places between pages.

## Scenario: keep drafts hidden from public API

- Set `cptVisibleStatuses(['publish'])`
- Keep `permissions.get/list = true`
- Draft rows return `404 not_found` even when ID exists

## Delete mode (v0.3.0)

`deleteMode('trash')` routes `DELETE` through `wp_trash_post()` so rows can be restored from the WP trash. `deleteMode('force')` (default) calls `wp_delete_post(..., true)` and removes the row immediately.

## Capability-checked writes (v0.3.0)

CPT writes are validated against WordPress capabilities for publish, status transitions, author changes, and deletes. A user with only `edit_posts` cannot publish or change author without the matching capability — even if the policy allowed `update`.

## Common mistakes

- Allowing `status` filter but forgetting to declare schema enum
- Exposing draft/private without explicit decision
- Forgetting to set `deleteMode('trash')` when the UX expects WP-style restore
- Granting `update` via policy but expecting publish/author changes without the underlying WP capability
- Using `cptVisibilityPolicy()` for a condition that could be a declared filter — the full-scan cost on large post types is avoidable *(v1.1.0)*

## Validation checklist

- list route returns only visible statuses
- get route returns `404` for hidden statuses
- policy permission callbacks execute per action
