---
title: Audit
---

`AuditMiddleware` emits structured audit events around each request. *(v0.5.0)* `AuditEnricherMiddleware` lets callers attach domain-safe metadata to those events without changing handlers.

## Minimal example

```php
use BetterRoute\Middleware\Audit\AuditMiddleware;
use BetterRoute\Middleware\Audit\ErrorLogAuditLogger;

$audit = new AuditMiddleware(
    logger: new ErrorLogAuditLogger()
);
```

## Event schema highlights

Produced by `AuditEventFactory`:

- `event` (`http_request`)
- `timestamp`
- `requestId` and `traceId`
- `route`, `method`
- `outcome` (`success|error`)
- `statusCode`
- `errorCode` and `error` message (on failure) — *(v1.1.0)* for non-`ApiException` throwables the event message is redacted to `Unexpected error.`, matching the HTTP response; raw internal exception messages no longer reach the audit log
- `durationMs`
- compatibility alias: `status` (`ok|error`)
- *(v0.5.0)* any keys merged from `RequestContext::$attributes['audit']` (see below)

## Enrichment (v0.5.0)

`AuditMiddleware` reads `RequestContext::$attributes['audit']` (associative array) and merges it into the emitted event under the existing schema. Anything you write to that attribute — directly or via `AuditEnricherMiddleware` — appears alongside the built-in fields.

```php
use BetterRoute\Middleware\Audit\AuditEnricherMiddleware;
use BetterRoute\Middleware\Audit\AuditMiddleware;

$router->middleware([
    new AuditEnricherMiddleware(
        staticFields: ['resource' => 'account', 'channel' => 'public-client'],
        includeClientIp: true
    ),
    new AuditMiddleware($logger),
]);
```

`AuditEnricherMiddleware` adds the following keys to the `audit` attribute:

| Key | Source | Notes |
|---|---|---|
| `authProvider` / `authUserId` / `authSubject` | `RequestContext::$attributes['auth']` | Only emitted for fields actually present on the auth attribute. |
| `idempotencyKey` | request `Idempotency-Key` header | Stored as a SHA-1 hash — never the raw value. |
| `clientIp` | `ClientIpResolver` | Only when `includeClientIp: true`. Pass a custom resolver to honor your trusted proxies. |
| any keys in `staticFields` | constructor arg | Passed through verbatim. Keep these domain-safe (no PII). |

Existing values on `audit` are preserved — handlers or earlier middleware can call `$ctx->withAttribute('audit', [...])` and the enricher merges into them rather than replacing.

### Order matters

Place `AuditEnricherMiddleware` **after** any auth middleware that populates `auth`, and **before** `AuditMiddleware` so the enriched attribute is in place when the event is emitted:

```
... -> AuthMiddleware -> AuditEnricherMiddleware -> AuditMiddleware -> handler
```

If you only need `AuditMiddleware` to read `audit` attributes you set in the handler (e.g. `domainEvent => 'order.cancelled'`), the enricher is optional.

### Constructor

```php
new AuditEnricherMiddleware(
    array $staticFields = [],
    ?ClientIpResolver $clientIpResolver = null,
    bool $includeClientIp = false
);
```

## v1.1.0 behavior changes

- **Logger failures are best-effort.** A logger that throws inside `log()` is swallowed: the API response is returned unchanged, and an application exception already in flight propagates instead of being masked by the telemetry failure.
- **Internal error messages are redacted** in error events (see the schema note above).

## Scenario: audit trail for regulated writes

- attach `AuditEnricherMiddleware` + `AuditMiddleware` to the sensitive route group
- enricher carries the auth provider/subject and a hashed idempotency key, so duplicate retries are correlatable
- feed events into SIEM/log pipeline
- correlate by `requestId` across systems

## Common mistakes

- Logging only failures (lose the success baseline)
- Emitting raw idempotency keys, tokens, or PII through `staticFields` — keep `audit` payloads safe to ship to a log aggregator
- Placing the enricher before auth — `authUserId` will be missing on every event
- Writing unstructured free-text events directly to the logger

## Validation checklist

- both success and error flows emit events
- duration is captured in milliseconds
- enriched events carry `authProvider`/`authUserId`/`authSubject` when an auth middleware ran upstream
- `idempotencyKey` in the event is a hash, not the raw header value
- event payload is JSON serializable
