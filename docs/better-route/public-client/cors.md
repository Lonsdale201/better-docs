---
title: CORS / Preflight
---

`CorsMiddleware` *(v0.5.0)* gives a public-client REST surface a deliberate CORS contract instead of relying on default WordPress behavior. Pair it with `Router::options()` for explicit preflight endpoints.

## Minimal example

```php
use BetterRoute\Middleware\Cors\CorsMiddleware;
use BetterRoute\Middleware\Cors\CorsPolicy;

$router->middleware([
    new CorsMiddleware(new CorsPolicy(
        allowedOrigins: ['https://app.example.com'],
        allowCredentials: true
    )),
]);
```

The policy applies to every route inside the router/group. Preflight `OPTIONS` requests short-circuit with `204` and the negotiated headers — the handler is not called.

## `CorsPolicy` constructor

```php
new CorsPolicy(
    array $allowedOrigins,
    array $allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    array $allowedHeaders = [
        'Authorization',
        'Content-Type',
        'Idempotency-Key',
        'If-Match',
        'If-None-Match',
        'X-Request-ID',
        'X-WP-Nonce',
    ],
    array $exposedHeaders = [
        'ETag',
        'Idempotency-Replayed',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Request-ID',
    ],
    bool $allowCredentials = false,
    int $maxAgeSeconds = 600
);
```

- `allowedOrigins` — exact origin strings. Use `['*']` for wildcard **without credentials**. **Since 1.0.0**, constructing `CorsPolicy` with `['*']` **and** `allowCredentials: true` throws `InvalidArgumentException`: reflecting an arbitrary origin back together with `Access-Control-Allow-Credentials: true` would defeat the same-origin policy for authenticated endpoints. List explicit origins when credentials are enabled.
- `allowedMethods` / `allowedHeaders` / `exposedHeaders` — emitted as `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Expose-Headers`. The defaults already include the headers and response markers used by other better-route middleware.
- `allowCredentials` — emits `Access-Control-Allow-Credentials: true`. Required when the browser sends cookies or `Authorization` with credentials.
- `maxAgeSeconds` — preflight cache duration.

## `CorsMiddleware` constructor

```php
new CorsMiddleware(
    CorsPolicy $policy,
    bool $rejectDisallowedOrigins = true
);
```

When `rejectDisallowedOrigins` is `true` (default) and the request carries an `Origin` header that the policy does not allow, the middleware throws `403 cors_origin_denied`. Set it to `false` if you want disallowed origins to fall through and reach WordPress without CORS headers (the browser then blocks the response itself).

## Preflight endpoints

WordPress does not register `OPTIONS` handlers automatically. 0.5.0 adds `Router::options()` and a public-by-default permission for `OPTIONS` routes:

```php
$router->options('/account/orders/(?P<id>\d+)', static fn () => null);
```

The handler body is irrelevant — `CorsMiddleware` short-circuits with `204` and the negotiated headers before the handler runs. The route exists so WordPress dispatches the method to better-route in the first place.

## Origin echo behavior

| `allowedOrigins` | `allowCredentials` | Request origin | `Access-Control-Allow-Origin` |
|---|---|---|---|
| `['https://app.example.com']` | any | `https://app.example.com` | `https://app.example.com` |
| `['https://app.example.com']` | any | `https://other.example.com` | none → `403 cors_origin_denied` (default) |
| `['*']` | `false` | any | `*` |
| `['*']` | `false` | none | `*` |
| `['*']` | `true` | — | **rejected at construction** — `CorsPolicy` throws `InvalidArgumentException` (since 1.0.0) |

`Vary: Origin` is always emitted when CORS headers are produced.

## Combining with auth

CORS must run before any middleware that can throw on the request (auth, rate limit, idempotency). Otherwise preflight `OPTIONS` requests will be rejected by auth (browsers do not send `Authorization` on preflight), and the browser will never get the headers it needs.

```php
$router->middleware([
    new CorsMiddleware($policy),     // 1. preflight short-circuits here
    new RateLimitMiddleware(...),    // 2. preflight is already gone
    new MetricsMiddleware(...),
    new AuditMiddleware(...),
]);

$router->group('/account', function (Router $r) use ($jwt): void {
    $r->middleware([$jwt]);          // auth only on real requests
    // ...
});
```

## Common mistakes

- Adding `CorsMiddleware` after auth — preflight requests are rejected with `401`.
- Using `['*']` with `allowCredentials: true` — **since 1.0.0 this throws at construction**. Reflecting an arbitrary origin back with credentials defeats the same-origin policy; list explicit origins when credentials are enabled.
- Forgetting to register `OPTIONS` routes — WP dispatches a `404` before better-route sees the request.
- Stripping default exposed headers — clients lose access to `ETag`, `Idempotency-Replayed`, and rate-limit telemetry.

## Validation checklist

- preflight `OPTIONS` from an allowed origin returns `204` with `Access-Control-Allow-*` headers;
- preflight from a disallowed origin returns `403 cors_origin_denied` (when `rejectDisallowedOrigins=true`);
- the real request carries `Access-Control-Allow-Origin` and `Vary: Origin`;
- exposed headers are visible to the browser fetch caller (test with `response.headers.get(...)`).
