---
title: Optimistic Locking
---

`OptimisticLockMiddleware` enforces version preconditions (`If-Match` or request param).

## Minimal example

```php
use BetterRoute\Middleware\Write\CallbackOptimisticLockVersionResolver;
use BetterRoute\Middleware\Write\OptimisticLockMiddleware;

$versionResolver = new CallbackOptimisticLockVersionResolver(
    static function ($context): string|int|null {
        // Resolve current version from DB/entity
        return 'v12';
    }
);

$optimisticLock = new OptimisticLockMiddleware(
    versionResolver: $versionResolver,
    required: true,
    headerName: 'if-match',
    paramName: 'version'
);
```

## Behavior

- missing expected version and `required=true` -> `428 precondition_required` *(since 1.0.0; was `412`)*, thrown as `PreconditionRequiredException`
- missing current version -> `409 version_unavailable`
- mismatch -> `412 optimistic_lock_failed`
- match -> passes and stores `optimisticLock` attribute in context

Also accepts wildcard expected version: `If-Match: *`.

**Since 1.0.0:** a *missing* precondition returns `428 Precondition Required` (RFC 6585) via `PreconditionRequiredException`; `412 Precondition Failed` is now reserved for a precondition that was supplied but did not match.

## Common mistakes

- Not returning deterministic current version from resolver
- Using stale versions from cache for write checks
- Skipping lock on endpoints with concurrent edits

## Validation checklist

- quoted ETag forms normalize correctly
- mismatch includes expected/current in error details
- successful request has `optimisticLock` context attributes
