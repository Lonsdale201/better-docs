---
title: Single-Use Tokens
---

`SingleUseTokenMiddleware` *(v0.6.0)* enforces that a token presented by the client is consumed at most once. It is the building block for OAuth authorization codes, magic-link sign-ins, password resets, email verification links, and any other one-time grant that must not be re-used.

The middleware hashes the token before any store access, consumes it atomically, and attaches the issuer-supplied context to the request so the handler can read what the token was bound to.

## What this is

Single-use tokens are different from idempotency keys:

- **Idempotency** prevents a single logical request from running twice across retries.
- **Single-use tokens** prevent a one-time grant from being spent more than once. The same handler logic should run on the first call and reject every subsequent call.

The store is also separate from the idempotency store — they have different lifecycles and different invariants.

## Minimal example

```php
use BetterRoute\Middleware\Write\SingleUseTokenMiddleware;
use BetterRoute\Middleware\Write\WpdbSingleUseTokenStore;

register_activation_hook(__FILE__, function (): void {
    (new WpdbSingleUseTokenStore())->installSchema();
});

$store = new WpdbSingleUseTokenStore();

$middleware = new SingleUseTokenMiddleware(
    store: $store,
    tokenSource: static fn (mixed $request): ?string =>
        is_object($request) && method_exists($request, 'get_param')
            ? (string) $request->get_param('code')
            : null,
    onConsumed: null,
    hashSalt: '',           // empty -> derived from wp_salt('auth') (since 1.0.0)
    ttlSeconds: 300
);

$router->post('/oauth/token', $handler)
    ->middleware([$middleware])
    ->meta(['error_format' => 'oauth_rfc6749'])
    ->publicRoute();
```

## Issuing a token

The middleware does not generate tokens — it only consumes them. Generate the token with `Crypto::token()` (or another CSPRNG), persist it via `storeToken()`, and hand the **plaintext** value to the user. Keep the salt the same on both sides (issue and consume).

```php
use BetterRoute\Support\Crypto;

$plaintext = Crypto::token(32); // 32 bytes -> 43-char base64url string

$middleware->storeToken(
    token: $plaintext,
    context: [
        'userId' => $userId,
        'scope'  => 'reset_password',
        'expiresAt' => time() + 900,
    ],
    ttlSeconds: 900
);

// Hand $plaintext to the user (link, email, etc).
// Do NOT store $plaintext — only the hash is persisted.
```

`storeToken()` calls `hashToken()` internally; only the HMAC-SHA256 digest of the token reaches the store.

## Constructor

```php
new SingleUseTokenMiddleware(
    SingleUseTokenStoreInterface $store,
    callable $tokenSource,
    ?callable $onConsumed = null,
    string $hashSalt = '',
    int $ttlSeconds = 300
);
```

- `tokenSource(mixed $request): ?string` — pulls the token off the request. Common sources: a `code` body param, a query string, a custom header.
- `onConsumed(array $context, mixed $request, RequestContext $next): mixed` — optional hook called right after a successful consume. Return a `RequestContext` to replace the one passed forward (e.g. to enrich `auth` from the token context). Return anything else and the original context is used.
- `hashSalt` — caller-provided salt. **Since 1.0.0** an empty salt is derived from the documented `wp_salt('auth')` scheme (HMAC-bound to a library-specific context), rather than a custom `wp_salt()` scheme. The middleware throws if no salt can be resolved (e.g. WordPress not loaded and no explicit salt passed).
- `ttlSeconds` — default TTL passed to the store when `storeToken()` is called without an override.

## Behavior

| Situation | Status | Code |
|---|---|---|
| `tokenSource` returns null/empty | `400` | `single_use_token_required` |
| Token unknown or expired | `401` | `invalid_single_use_token` |
| Token already consumed | `409` | `single_use_token_reused` |
| Token consumed successfully | passes to handler with `singleUseToken` attribute | — |

On success the consumed context is exposed under `RequestContext::$attributes['singleUseToken']`. Handlers can read it to learn which user the token was issued to, what scope it carries, etc.

```php
$ctx->attributes['singleUseToken']; // ['userId' => 17, 'scope' => 'reset_password', ...]
```

## Stores

`SingleUseTokenStoreInterface` defines three operations:

```php
interface SingleUseTokenStoreInterface
{
    /** @return array<string, mixed>|null  null when token unknown or expired */
    public function consume(string $tokenHash): ?array;

    /** @param array<string, mixed> $context */
    public function store(string $tokenHash, array $context, int $ttlSeconds): void;

    public function wasConsumed(string $tokenHash): bool;
}
```

### `WpdbSingleUseTokenStore`

`wpdb`-backed table with TTL pruning. Use this in production for code consumption flows that must survive object-cache flushes.

```php
$store = new WpdbSingleUseTokenStore(
    table: 'better_route_single_use_tokens',
    prefix: null // null -> $wpdb->prefix
);
$store->installSchema();
```

- The table name is validated at every access (`/^[A-Za-z_][A-Za-z0-9_]*$/`). Cross-database names containing `.` are rejected.
- `consume()` issues a single `UPDATE ... WHERE used = 0 AND expires_at > now`, then reads back the context. The atomic flip is what guarantees one-time consumption under concurrent retries.
- Expired rows are pruned on every consume/wasConsumed call.

### `WpCacheSingleUseTokenStore`

Object-cache + transient-backed alternative for hosts with a persistent object cache:

```php
$store = new WpCacheSingleUseTokenStore(
    group: 'better_route_single_use',
    lockTtlSeconds: 10
);
```

- Uses `wp_cache_add` as a short consume lock (default `10` seconds) plus transients for the record and the consumed marker.
- Throws at construction if any of `wp_cache_add`, `wp_cache_delete`, `get_transient`, `set_transient`, or `delete_transient` is unavailable.
- **Since 1.0.0** it also throws at construction when no persistent object cache is present (`wp_using_ext_object_cache()` is `false`). The `wp_cache_add` consume-lock is only cross-request atomic with a persistent cache (Redis, Memcached); without one, two concurrent requests could each take an in-process lock and consume the same token twice. Use `WpdbSingleUseTokenStore` on hosts without a persistent object cache.

### `ArraySingleUseTokenStore`

In-memory store for tests only. State does not persist across requests.

## Token hashing

```php
SingleUseTokenMiddleware::hashToken(string $token, string $salt): string
```

HMAC-SHA256 with a caller-supplied salt. The middleware uses the same call before every store access, so callers must use the **same salt** when issuing tokens. Empty salts throw — if you do not pass one explicitly, ensure WordPress is loaded so `wp_salt()` can return one.

The store layer further hashes (`SHA-256`) the HMAC digest before using it as a primary key, so the persisted column is a hash of a hash. Plaintext tokens never reach the database.

## Worked example: OAuth authorization code

```php
use BetterRoute\Http\Response;
use BetterRoute\Middleware\Write\SingleUseTokenMiddleware;
use BetterRoute\Middleware\Write\WpdbSingleUseTokenStore;
use BetterRoute\Support\Crypto;

$store = new WpdbSingleUseTokenStore();

// At /oauth/authorize: issue the code after the user consents
$code = Crypto::token(32);
$middleware = new SingleUseTokenMiddleware(
    store: $store,
    tokenSource: static fn ($req): ?string => (string) $req->get_param('code'),
    ttlSeconds: 600
);
$middleware->storeToken($code, [
    'clientId' => $clientId,
    'userId'   => $userId,
    'scope'    => $scope,
    'redirect' => $redirectUri,
], ttlSeconds: 600);

// At /oauth/token: consume the code and issue the access token
$router->post('/oauth/token', static function ($ctx) {
    $codeContext = $ctx->attributes['singleUseToken'] ?? [];
    // ... issue access/refresh tokens bound to $codeContext ...
    return Response::ok(['access_token' => '...', 'token_type' => 'Bearer']);
})
    ->middleware([$middleware])
    ->meta(['error_format' => 'oauth_rfc6749'])
    ->publicRoute();
```

A second `POST /oauth/token` with the same code returns `409 single_use_token_reused` (or, in OAuth error format, `error: "invalid_request"` with the underlying status).

## Validation checklist

- first POST with a valid token returns `200` and runs the handler;
- second POST with the same token returns `409 single_use_token_reused`;
- POST with an unknown token returns `401 invalid_single_use_token`;
- POST without a token returns `400 single_use_token_required`;
- the persisted store column is **not** the plaintext token.

## Common mistakes

- Storing the plaintext token on the issuer side. Only the user should hold it.
- Using a different salt at issue time and consume time — the digest will not match and every consume returns `null`.
- Picking `WpCacheSingleUseTokenStore` on a host without a persistent object cache — **since 1.0.0 it throws at construction** instead of silently allowing double-consumption. Use `WpdbSingleUseTokenStore` there.
- Reusing the idempotency store for single-use tokens. The two stores have different invariants and TTL strategies — keep them separate.
