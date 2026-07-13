---
title: CORS / Preflight
---

`CorsMiddleware` *(v0.5.0)* gives a public-client REST surface a deliberate CORS contract instead of relying on default WordPress behavior. Since v1.1.0 it also installs a **WordPress CORS bridge** at `Router::register()` time, which answers preflight before WordPress dispatches the route and keeps the configured allowlist authoritative over core CORS headers — explicit `Router::options()` preflight routes are no longer required.

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

Attach the middleware **before** calling `Router::register()` — registration is the moment each matched route is announced to the WordPress bridge *(v1.1.0)*.

## WordPress CORS bridge *(v1.1.0)*

`CorsMiddleware` implements `WordPressRouteMiddlewareInterface`. When a route carrying it is registered, the route pattern is recorded in `WordPressCorsBridge`, which hooks two WordPress filters:

- `rest_pre_dispatch` (priority 9) — if the incoming request is a CORS preflight for a matched route, the bridge responds immediately: `204` with the negotiated headers for an allowed origin, or `403 cors_origin_denied` when the origin is disallowed and `rejectDisallowedOrigins` is `true`. The route callback and its `permission_callback` never run, so preflight works even though `OPTIONS` routes deny by default since v1.1.0.
- `rest_pre_serve_request` (priority 20) — for matched routes, the bridge removes the `Access-Control-*` headers WordPress core emitted and replaces them with the policy's headers, merging `Vary` tokens. The configured allowlist is authoritative; core's permissive defaults cannot leak through.

The bridge only affects routes that carry `CorsMiddleware` — the rest of the REST API keeps WordPress default behavior.

## Configuration validation *(v1.1.0)*

`CorsPolicy` validates its configuration at construction and throws `InvalidArgumentException` for: origins that are not valid serialized origins (`scheme://host[:port]`, no path/query/fragment/userinfo, no CR/LF), method or header names that are not valid HTTP tokens, and negative `maxAgeSeconds`. This blocks response-header injection through configuration values.

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

Since v1.1.0 you normally don't need any: the WordPress bridge answers preflight for every route that carries `CorsMiddleware`, before WordPress even dispatches the request.

Explicit `Router::options()` routes *(v0.5.0)* still work — for example when you want a preflight-like endpoint in the OpenAPI document. Note that since v1.1.0 `OPTIONS` routes deny by default like every other method, so an explicit preflight route needs explicit intent:

```php
$router->options('/account/orders/(?P<id>\d+)', static fn () => null)
    ->publicRoute();
```

The handler body is irrelevant — the bridge (or `CorsMiddleware` in the pipeline) short-circuits with `204` and the negotiated headers before the handler runs.

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
- Attaching `CorsMiddleware` after `Router::register()` has already run — the bridge never learns about the routes, so preflight falls through to WordPress defaults.
- Stripping default exposed headers — clients lose access to `ETag`, `Idempotency-Replayed`, and rate-limit telemetry.

## Validation checklist

- preflight `OPTIONS` from an allowed origin returns `204` with `Access-Control-Allow-*` headers;
- preflight from a disallowed origin returns `403 cors_origin_denied` (when `rejectDisallowedOrigins=true`);
- the real request carries `Access-Control-Allow-Origin` and `Vary: Origin`;
- exposed headers are visible to the browser fetch caller (test with `response.headers.get(...)`).
