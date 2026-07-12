---
title: AI Agent Skills
sidebar_position: 99
---

This page defines structured skills an AI agent needs to work effectively with the `better-route` library. Each skill describes a specific capability, when to use it, and the exact steps or API surface involved.

Aligned with the **v0.6.0** release. See [Release Notes — v0.6.0](release-notes/v0.6.0) for the full changelog and [v0.5.0](release-notes/v0.5.0) for the previous baseline.

## Skill: Install better-route

**When:** The user wants to add `better-route` to a WordPress project.

**Requirements:**
- PHP `^8.1`
- WordPress with REST API (`rest_api_init` hook)
- Composer
- OpenSSL extension (for `Rs256JwksJwtVerifier` — v0.6.0)

**Steps:**
1. The package is published on Packagist (since v1.0.0) — install it directly, no repository entry needed.
2. Run `composer require better-route/better-route:^1.0`.

**Install:**
```bash
composer require better-route/better-route:^1.0
```

Only add a VCS `repositories` entry (pointing at `https://github.com/Lonsdale201/better-route`) if you need to track an unreleased branch or a fork.

**Verification:**
```bash
composer show better-route/better-route
```

**Rules:**
- Plain `composer require` works — no `repositories` block needed since v1.0.0.
- All route registration must happen inside a `rest_api_init` action hook.
- Available quality commands: `composer test`, `composer analyse`, `composer cs-check` (run via `php vendor/bin/...` since v0.3.0).

---

## Skill: Migrate a project to v1.0.0

**When:** The user is upgrading to v1.0.0 (the first stable release).

**Steps:**
1. Bump the constraint to `^1.0` and run `composer update better-route/better-route`.
2. Mostly a consolidation of the 0.3–0.6 line, but 1.0.0 ships a few intentional **behavior changes** (fail-safe hardening) — review the [v1.0.0 release notes](release-notes/v1.0.0): email/login claim mapping off by default, granted-scope wildcards opt-in, CORS wildcard+credentials rejected, Woo money as strings, HPOS `503`, `428` for missing preconditions.
3. Decide whether the project benefits from the new identity/network primitives:
   - `Rs256JwksJwtVerifier` + `HttpJwksProvider` — when the issuer publishes a JWKS endpoint (most OIDC providers).
   - `HmacSignatureMiddleware` — when partners send signed webhooks with shared secrets.
   - `SingleUseTokenMiddleware` + `WpdbSingleUseTokenStore` — when a route consumes OAuth codes, magic links, password resets, or similar one-time grants.
   - `TrustedProxyClientIpResolver` + `IpAllowlistMiddleware` — when the API sits behind Cloudflare/load balancers and needs CIDR-based access control.
   - `meta(['error_format' => 'oauth_rfc6749'])` — for routes that wrap an OAuth surface.
   - `Crypto` helper — for any handler-level token generation, base64url encoding, or constant-time compare.
4. Run `(new WpdbSingleUseTokenStore())->installSchema()` on plugin activation if you adopt single-use tokens. The table is **separate** from the existing idempotency tables.
5. If upgrading from older versions, walk through the v0.5.0 / v0.4.0 / v0.3.0 checklists below.

**v0.6.0 changes (additive — no breaking changes):**

| Area | Notes |
|---|---|
| `Http\ClientIpResolver` | Now delegates internally to `TrustedProxyClientIpResolver`. Constructor and `resolve(?array $server = null)` API unchanged. |
| `RateLimitMiddleware` | `clientIpResolver` accepts either `Http\ClientIpResolver` or `Middleware\Network\ClientIpResolverInterface`. Existing constructor calls keep working. |
| `Hs256JwtVerifier` | Internally rewired to use `Crypto::equals()` and `Crypto::base64UrlDecode()`. Behavior unchanged. |
| `Router::dispatch()` | Adds normalized route metadata to `RequestContext::$attributes['routeMeta']`. Existing handlers ignore unknown attributes. |
| New verifiers | `Rs256JwksJwtVerifier`, `HttpJwksProvider`, `StaticJwksProvider`. Strict `kid`, algorithm pinning, private-field stripping. |
| New middleware | `HmacSignatureMiddleware`, `SingleUseTokenMiddleware`, `IpAllowlistMiddleware`. All opt-in. |
| OAuth error format | Route-level opt-in via `meta(['error_format' => 'oauth_rfc6749'])`. Default envelope unchanged for every other route. |

**v0.5.0 changes (still applies for older upgrades):**

| Area | Notes |
|---|---|
| `Router::options()` | Method for explicit preflight routes. `OPTIONS` permissions default to public. |
| `AuditMiddleware` | Merges `RequestContext::$attributes['audit']` into emitted events. |
| `RateLimitMiddleware` | Array handler responses are wrapped into `Response` so rate-limit headers survive. |
| `AtomicIdempotencyMiddleware`, `CorsMiddleware`, `OwnershipGuardMiddleware`, `AuditEnricherMiddleware` | All opt-in. |

**v0.4.0 migration (still applies for older upgrades):**

| Area | Action required |
|---|---|
| **Raw Router write routes** | `POST`/`PUT`/`PATCH`/`DELETE` without an explicit permission callback now deny by default. Add `->permission()`, `->protectedByMiddleware()`, or `->publicRoute()`. `GET` is unchanged. |

**v0.3.0 breaking-change checklist (still applies for older upgrades):**

| Area | Action required |
|---|---|
| **OpenAPI doc endpoint** | Defaults to `manage_options`. If the doc must stay public, pass `'permissionCallback' => static fn (): bool => true`. |
| **Custom table resources** | Deny-by-default. Add `->policy(ResourcePolicy::publicReadPrivateWrite())` (or another preset) to keep them reachable. |
| **JWT** | `exp` claim is required by default. Either ensure tokens carry `exp`, or pass `requireExpiration: false` to `Hs256JwtVerifier`. |
| **`WpClaimsUserMapper`** | `sub` is no longer in default `idClaims`. Re-add it explicitly if your tokens rely on it. |
| **Woo customers** | Endpoints are restricted to users with the `customer` role; create/update/delete require `create_users` / `edit_user` / `delete_user`. |
| **Woo meta keys** | Keys starting with `_` are no longer writable or returned. Pass `$allowProtected = true` only when intentional. |
| **Default cache/idempotency/rate-limit keys** | Identity-aware. If you relied on the old defaults, pass an explicit `keyResolver` to preserve keys. |

**Verification:**
- All endpoints that should be reachable still respond `200` (no unintended `403`s on writes).
- Auth flows still issue tokens with `exp` and roles compatible with the v0.3.0 restrictions.
- OpenAPI doc visibility matches your intent.

---

## Skill: Register WooCommerce routes

**When:** The user wants to expose WooCommerce data (orders, products, customers, coupons) via REST API.

**Steps:**
1. Ensure WooCommerce is active on the target WordPress site.
2. Call `BetterRoute::wooRouteRegistrar()->register('vendor/v1', $options)` inside a `rest_api_init` action hook.
3. The `$options` array controls: `basePath`, `requireHpos`, `defaultPerPage`, `maxPerPage`, `permissions`, `actions`, `idempotency`, `deleteMode`.
4. To expose only specific resources or actions, use the `actions` key (e.g. `'orders' => ['list', 'get']`).

**Example:**
```php
add_action('rest_api_init', function () {
    \BetterRoute\BetterRoute::wooRouteRegistrar()
        ->register('myapp/v1', [
            'basePath'    => '/shop',
            'requireHpos' => true,
            'deleteMode'  => 'trash',
            'actions'     => [
                'products' => ['list', 'get'],
                'orders'   => ['list', 'get', 'create', 'update', 'delete'],
            ],
            'permissions' => [
                'orders.create' => 'manage_woocommerce',
                'orders.delete' => 'manage_woocommerce',
            ],
        ]);
});
```

**Rules (v0.3.0):**
- Customer endpoints reject users without the `customer` role.
- Customer create/update/delete additionally require `create_users` / `edit_user` / `delete_user`.
- Meta keys starting with `_` are not returned and not writable unless the caller explicitly opts in via `$allowProtected = true`.

---

## Skill: Register custom REST routes

**When:** The user wants to create custom REST endpoints (non-WooCommerce).

**Steps:**
1. Create a `Router` via `BetterRoute::router('vendor', 'v1')`.
2. Use `->get()`, `->post()`, `->put()`, `->patch()`, `->delete()` to define routes.
3. Each route accepts a path, a callback, and optional metadata array.
4. **For write methods (POST/PUT/PATCH/DELETE), declare intent** with `->permission()`, `->protectedByMiddleware()`, or `->publicRoute()` — they deny by default since v0.4.0.
5. Register inside a `rest_api_init` action hook.

**Example:**
```php
add_action('rest_api_init', function () {
    $router = \BetterRoute\BetterRoute::router('myapp', 'v1');

    $router->get('/ping', function ($context) {
        return \BetterRoute\Http\Response::ok(['pong' => true]);
    });

    $router->post('/articles', $createArticle)
        ->permission(static fn () => current_user_can('edit_posts'));

    $router->post('/secure/articles', $createArticle)
        ->protectedByMiddleware('bearerAuth');

    $router->post('/webhooks/intake', $intake)
        ->publicRoute();

    $router->register();
});
```

**Rules (v0.4.0):**
- Raw `Router` write methods (`POST`/`PUT`/`PATCH`/`DELETE`) without an explicit permission callback **deny by default** at the WordPress permission layer. `GET` stays public by default.
- `->protectedByMiddleware($security = null)` defers authorization to the better-route middleware pipeline.
- `->publicRoute()` marks the route as intentionally public and clears OpenAPI `security` for the operation.

**Rules (v0.3.0):**
- Route handlers receive `id` from the URL route parameters first; query/body `id` is only consulted if the URL does not provide one.
- Inbound `X-Request-ID` is accepted only if it matches `^[A-Za-z0-9._:-]{1,128}$`; otherwise a fresh id is generated.

---

## Skill: Verify RS256/ES256 JWTs from a JWKS provider (v0.6.0)

**When:** The user authenticates against an OIDC-style provider that publishes a JWKS endpoint (Auth0, Keycloak, Cognito, Azure AD, Google Identity, etc.). The token is signed with a private key the API never sees.

**Steps:**
1. Build an `HttpJwksProvider` pointing at the issuer's JWKS endpoint.
2. Build an `Rs256JwksJwtVerifier` with the provider plus the expected issuer/audience.
3. Plug the verifier into `JwtAuthMiddleware` exactly like the HS256 verifier.

**Example:**
```php
use BetterRoute\Middleware\Jwt\HttpJwksProvider;
use BetterRoute\Middleware\Jwt\JwtAuthMiddleware;
use BetterRoute\Middleware\Jwt\Rs256JwksJwtVerifier;
use BetterRoute\Middleware\Auth\WpClaimsUserMapper;

$jwks = new HttpJwksProvider(
    jwksUri: 'https://issuer.example.com/.well-known/jwks.json',
    ttlSeconds: 3600,
    issuer: 'https://issuer.example.com'
);

$verifier = new Rs256JwksJwtVerifier(
    jwks: $jwks,
    expectedIssuer: 'https://issuer.example.com',
    expectedAudience: 'better-route',
    requireExpiration: true,
    maxLifetimeSeconds: 3600,
    allowedAlgorithms: ['RS256']
);

$jwt = new JwtAuthMiddleware(
    verifier: $verifier,
    requiredScopes: ['account:read'],
    userMapper: new WpClaimsUserMapper()
);
```

**Rules:**
- `HttpJwksProvider` rejects non-`https` URIs at construction.
- The verifier rejects `none` and any `HS*` algorithm even if accidentally configured.
- Strict `kid` matching only — the verifier never tries unrelated keys to "find one that verifies."
- On a `kid` miss the JWKS is refreshed once and the lookup is retried; further misses fail with `401 invalid_token`.
- Trigger a manual cache refresh via `do_action('better_route/jwks_refresh')` (or with the issuer string for issuer-scoped invalidation).
- Pass `StaticJwksProvider` in tests to avoid the HTTP call.

**Verification:**
- `composer test` exercises strict `kid`, ES256 keys, RS-only allowlist, and private-field stripping in `tests/SecurityPrimitivesTest.php`.

---

## Skill: Verify HMAC-signed webhooks (v0.6.0)

**When:** A partner posts to your API with a signature header instead of a Bearer token. Stripe-style and GitHub-style webhook patterns.

**Steps:**
1. Build a secret provider (`ArrayHmacSecretProvider` for static key maps; a custom provider for Vault/Secrets Manager).
2. Build the `HmacSignatureMiddleware` with the headers your partner uses.
3. Attach to a `->publicRoute()` POST endpoint.

**Example:**
```php
use BetterRoute\Middleware\Auth\ArrayHmacSecretProvider;
use BetterRoute\Middleware\Auth\HmacSignatureMiddleware;

$secrets = new ArrayHmacSecretProvider([
    'kid-2026-q1' => $_ENV['HMAC_SECRET_Q1'],
    'kid-2026-q2' => $_ENV['HMAC_SECRET_Q2'],
]);

$signature = new HmacSignatureMiddleware(
    secrets: $secrets,
    signatureHeader: 'X-Signature',
    timestampHeader: 'X-Timestamp',
    keyIdHeader: 'X-Key-Id',
    replayWindowSeconds: 300,
    algorithm: 'sha256'
);

$router->post('/webhooks/intake', $handler)
    ->middleware([$signature])
    ->publicRoute();
```

**Canonical input:**
```text
timestamp + "\n" + method + "\n" + path + "\n" + sha256(body)
```

**Rules:**
- Defaults: headers `X-Signature` / `X-Timestamp` / `X-Key-Id`, `300` second replay window, `sha256`.
- Accepted signature encodings: lowercase hex, uppercase hex, base64, base64url, all four prefixed with `sha256=`.
- Comparison uses `Crypto::equals()` (constant time).
- Unknown key id → `401 invalid_signature`. Stale timestamp → `401 stale_signature`. Bad signature → `401 invalid_signature`.
- On success, `$ctx->attributes['hmac']` carries `keyId` and `algorithm`. The raw secret is never exposed.

**Verification:**
- `tests/SecurityPrimitivesTest.php` covers good/bad signature, timestamp replay, unknown key id.

---

## Skill: Consume single-use tokens (OAuth codes, magic links) (v0.6.0)

**When:** A route accepts a one-time grant the user holds in plaintext (OAuth `code`, magic-link query param, password reset token). The grant must be consumable exactly once and concurrent retries must not both succeed.

**Steps:**
1. Pick a store. Use `WpdbSingleUseTokenStore` in production. Run `installSchema()` once on plugin activation.
2. Build the middleware with a `tokenSource` callable that pulls the token off the request, and a salt (or rely on `wp_salt(...)`).
3. Issue tokens via `$middleware->storeToken($plaintext, $context, $ttl)` and hand `$plaintext` to the user.
4. Attach the middleware to the consumption route.

**Example:**
```php
use BetterRoute\Middleware\Write\SingleUseTokenMiddleware;
use BetterRoute\Middleware\Write\WpdbSingleUseTokenStore;
use BetterRoute\Support\Crypto;

register_activation_hook(__FILE__, function (): void {
    (new WpdbSingleUseTokenStore())->installSchema();
});

$store = new WpdbSingleUseTokenStore();

$middleware = new SingleUseTokenMiddleware(
    store: $store,
    tokenSource: static fn ($req): ?string => (string) $req->get_param('code'),
    ttlSeconds: 600
);

// Issue
$plaintext = Crypto::token(32);
$middleware->storeToken($plaintext, [
    'userId' => $userId,
    'scope'  => 'reset_password',
], ttlSeconds: 900);

// Consume
$router->post('/oauth/token', static function ($ctx) {
    $codeContext = $ctx->attributes['singleUseToken'] ?? [];
    return \BetterRoute\Http\Response::ok(['access_token' => '...']);
})
    ->middleware([$middleware])
    ->meta(['error_format' => 'oauth_rfc6749'])
    ->publicRoute();
```

**Rules:**
- The middleware **does not generate** tokens. Use `Crypto::token()` (or another CSPRNG) and call `storeToken()`.
- Token plaintext is HMAC-SHA256 hashed before any store access. The salt must be the same at issue and consume time. Empty salt → falls back to `wp_salt('better_route_single_use_token')`. Missing both → `RuntimeException`.
- `WpdbSingleUseTokenStore` is atomic via `UPDATE ... WHERE used = 0` and prunes expired rows on every access.
- `WpCacheSingleUseTokenStore` requires a persistent object cache (Redis/Memcached) — do not use it on shared hosting.
- `ArraySingleUseTokenStore` is for tests only; it does not survive across requests.
- Consumed context is exposed under `$ctx->attributes['singleUseToken']`.

**Errors:**
- Missing token → `400 single_use_token_required`.
- Unknown/expired → `401 invalid_single_use_token`.
- Reuse → `409 single_use_token_reused` (`ConflictException`).

---

## Skill: Resolve client IP behind proxies and deny outside an allowlist (v0.6.0)

**When:** The API sits behind Cloudflare or a load balancer. Some routes (back-channel webhooks, admin endpoints) must only be reachable from a known network.

**Steps:**
1. Build a `TrustedProxyClientIpResolver` with the trusted proxy CIDRs and the forwarded headers your edge sets.
2. Pass the resolver into `IpAllowlistMiddleware` along with the allowed CIDRs.
3. Attach to the route. Stack with HMAC or JWT auth as needed.

**Example:**
```php
use BetterRoute\Middleware\Network\IpAllowlistMiddleware;
use BetterRoute\Middleware\Network\TrustedProxyClientIpResolver;

$resolver = new TrustedProxyClientIpResolver(
    trustedProxyCidrs: ['173.245.48.0/20', '103.21.244.0/22', '2400:cb00::/32'],
    forwardedHeaders: ['CF-Connecting-IP', 'X-Forwarded-For']
);

$allowlist = new IpAllowlistMiddleware(
    allowedCidrs: ['198.51.100.0/24', '203.0.113.42'],
    ipResolver: $resolver,
    failClosed: true
);

$router->post('/webhooks/partner', $handler)
    ->middleware([$allowlist])
    ->publicRoute();
```

**Rules:**
- `TrustedProxyClientIpResolver` only honours forwarded headers when `REMOTE_ADDR` is inside `trustedProxyCidrs`. Otherwise headers are ignored.
- `X-Forwarded-For` uses the first valid IP in the comma-delimited list.
- `IpAllowlistMiddleware` with `failClosed: true` returns `403 client_ip_unavailable` when no IP can be resolved; `403 client_ip_not_allowed` when the IP is outside the CIDR list.
- Plug the resolver into `RateLimitMiddleware` (`clientIpResolver:` constructor argument) for proxy-aware rate-limit keys.
- The legacy `Http\ClientIpResolver` keeps working — its constructor and `resolve()` API are unchanged.

---

## Skill: Emit OAuth RFC 6749 error responses (v0.6.0)

**When:** A route mimics an OAuth provider (`/oauth/token`, `/oauth/authorize`, `/oauth/revoke`). OAuth client libraries expect `{ error, error_description }` instead of the better-route envelope.

**Steps:**
1. Add `meta(['error_format' => 'oauth_rfc6749'])` to the route.
2. Throw `ApiException` from the handler with the desired OAuth code (`invalid_grant`, `invalid_request`, ...). The normalizer passes the code through.

**Example:**
```php
$router->post('/oauth/token', $handler)
    ->meta(['error_format' => 'oauth_rfc6749'])
    ->publicRoute();
```

**Rules:**
- The flag is route-level. Other routes keep the default better-route envelope.
- `internal_error` is rewritten to `server_error` for 5xx responses.
- `request_id` is emitted only when the thrown exception's `details.requestId === true`. Off by default to match the RFC.
- `error_uri` is emitted when `details.error_uri` (or `errorUri`) is set on the exception.
- For non-`ApiException` 5xx, the message is normalized to `"Unexpected error."` so handler internals never leak.

---

## Skill: Generate tokens and compare in constant time (v0.6.0)

**When:** Handler-level code needs to mint an unguessable token (CSRF, magic link, internal job id) or compare a secret-derived value safely.

**Example:**
```php
use BetterRoute\Support\Crypto;
use BetterRoute\Support\CryptoEncoding;

$token = Crypto::token(32);                     // 43-char base64url
$hex   = Crypto::tokenHex(32);                  // 64-char hex
$b64   = Crypto::token(32, CryptoEncoding::Base64);

if (!Crypto::equals($expected, $candidate)) {
    throw new \BetterRoute\Http\ApiException('Invalid token.', 401, 'invalid_token');
}

$encoded = Crypto::base64UrlEncode($raw);
$decoded = Crypto::base64UrlDecode($encoded);   // throws RuntimeException on malformed input
```

**Rules:**
- `Crypto::token()` and `Crypto::tokenHex()` use `random_bytes` under the hood.
- `Crypto::equals()` wraps `hash_equals` — use it for any HMAC/digest comparison.
- `Crypto::base64UrlDecode()` is strict: alphabet-checked, length-checked, malformed input throws.

---

## Skill: Create a CPT resource

**When:** The user wants CRUD endpoints for a custom post type.

**Steps:**
1. Use `Resource::make('name')->sourceCpt('post_type')`.
2. Chain field definitions, query parameters, write schemas, and policy.
3. Call `->register($router)` to wire it into a router.

**Example:**
```php
use BetterRoute\Resource\Resource;
use BetterRoute\Resource\ResourcePolicy;

$resource = Resource::make('books')
    ->restNamespace('myapp/v1')
    ->sourceCpt('book')
    ->fields(['id', 'title', 'status', 'content', 'meta'])
    ->allowedStatuses(['publish', 'draft'])
    ->deleteMode('trash')
    ->policy(ResourcePolicy::publicReadPrivateWrite('edit_posts'))
    ->register($router);
```

---

## Skill: Create a custom-table resource

**When:** The user wants CRUD endpoints over a custom database table.

**Critical rule (v0.3.0):** Custom table resources are **deny-by-default**. Reads and writes both fail until an explicit policy is configured.

**Steps:**
1. Use `Resource::make('name')->sourceTable($tableName)`.
2. Configure fields, filters, and a `policy()` (raw permissions array, or a `ResourcePolicy` preset).
3. Register against a router.

**Example:**
```php
use BetterRoute\Resource\Resource;
use BetterRoute\Resource\ResourcePolicy;

Resource::make('audit_events')
    ->restNamespace('myapp/v1')
    ->sourceTable('myapp_audit_events')
    ->fields(['id', 'event_type', 'user_id', 'created_at'])
    ->filters(['event_type', 'user_id'])
    ->sort(['created_at', 'id'])
    ->policy(ResourcePolicy::adminOnly('manage_options'))
    ->register($router);
```

---

## Skill: Validate write payloads with `writeSchema`

**When:** The user wants resource POST/PUT/PATCH bodies validated and coerced before reaching the handler.

**Steps:**
1. Call `->writeSchema([...])` (alias `->payloadSchema()`) on the resource.
2. Each entry maps a field name to a rule array.

**Supported rule keys:**
- `type`: `'int'|'integer'|'float'|'number'|'bool'|'boolean'|'string'|'date'|'email'|'url'|'enum'|'array'|'object'|'mixed'`
- `required`: `true` (enforced on `create`)
- `nullable`: `true`
- `min` / `max` (numeric)
- `minLength` / `maxLength` (string)
- `regex` (string)
- `enum`: `['values' => [...]]`
- `sanitize`: `'text'|'email'|'key'|'url'|callable`

**Example:**
```php
Resource::make('books')
    ->sourceCpt('book')
    ->writeSchema([
        'title'    => ['type' => 'string', 'required' => true, 'minLength' => 1, 'maxLength' => 200, 'sanitize' => 'text'],
        'isbn'     => ['type' => 'string', 'regex' => '/^[0-9]{10,13}$/'],
        'price'    => ['type' => 'float', 'min' => 0],
        'status'   => ['type' => 'enum', 'enum' => ['values' => ['draft', 'publish']], 'required' => true],
        'website'  => ['type' => 'url', 'nullable' => true],
    ])
    ->register($router);
```

**Errors:**
Validation failures return:
```json
{
  "error": {
    "code": "validation_failed",
    "message": "Invalid request.",
    "details": { "fieldErrors": { "title": ["..."], "price": ["..."] } }
  }
}
```

---

## Skill: Apply field-level write policies

**When:** The user wants per-field authorization on writes (e.g., only admins can change `featured`).

**Steps:**
1. Call `->fieldPolicy([...])` on the resource.
2. Map fields to predicates that decide whether the current request may write that field.

**Example:**
```php
Resource::make('books')
    ->sourceCpt('book')
    ->fieldPolicy([
        'featured' => static fn ($request, string $action): bool
            => current_user_can('manage_options'),
        'price'    => static fn ($request, string $action): bool
            => current_user_can('edit_posts'),
    ])
    ->register($router);
```

---

## Skill: Apply a `ResourcePolicy` preset

**When:** The user needs a quick, typed permission setup.

**Available presets:**
- `ResourcePolicy::adminOnly(string $cap = 'manage_options')` — every action denied unless the user has the capability.
- `ResourcePolicy::publicReadPrivateWrite(string|array $writeCap = 'manage_options')` — `list`/`get` open; `create`/`update`/`delete` require the capability.
- `ResourcePolicy::capabilities(array $permissions)` — per-action caps. Keys: `list`, `get`, `create`, `update`, `delete`, `*`. Values: `bool`, capability string, list of capabilities, or callable.
- `ResourcePolicy::callbacks(array $callbacks)` — per-action `callable($request, string $action, Resource $self): bool`.

**Example:**
```php
$resource->policy(ResourcePolicy::capabilities([
    '*'      => 'edit_posts',
    'delete' => 'manage_options',
]));
```

---

## Skill: Add HS256 JWT authentication

**When:** The user wants to protect endpoints with JWTs they sign themselves (shared secret).

**Available middleware:**
- `JwtAuthMiddleware` — validates Bearer JWT tokens via any `JwtVerifierInterface`.
- `BearerTokenAuthMiddleware` — validates custom bearer tokens via callback.
- `Hs256JwtVerifier` — HS256 verifier for shared-secret tokens (since 0.3.0).
- `Rs256JwksJwtVerifier` *(v0.6.0)* — RS256/ES256 verifier backed by JWKS. See the dedicated skill above.
- `ApplicationPasswordAuthMiddleware` — validates WordPress application passwords.
- `CookieNonceAuthMiddleware` — validates WordPress cookie + nonce.

**Example (HS256):**
```php
use BetterRoute\Middleware\Jwt\JwtAuthMiddleware;
use BetterRoute\Middleware\Jwt\Hs256JwtVerifier;
use BetterRoute\Middleware\Auth\WpClaimsUserMapper;

$verifier = new Hs256JwtVerifier(
    secret: 'your-secret-key',
    leewaySeconds: 30,
    expectedIssuer: 'https://issuer.example.com',
    expectedAudience: 'myapp',
    requireExpiration: true,
    maxLifetimeSeconds: 3600,
    maxTokenLength: 8192
);

$jwt = new JwtAuthMiddleware(
    verifier: $verifier,
    requiredScopes: ['api:read'],
    userMapper: new WpClaimsUserMapper()
);

$router->group('/protected', function ($group) {
    $group->get('/me', fn($ctx) => Response::ok($ctx->user));
})->middleware($jwt);
```

**Rules (v0.3.0):**
- `exp` is required by default. Pass `requireExpiration: false` to disable.
- `expectedIssuer` and `expectedAudience` enable strict `iss`/`aud` validation when set.
- `maxLifetimeSeconds` rejects tokens whose `exp - iat` exceeds the cap.
- `maxTokenLength` rejects oversized tokens before parsing.
- `WpClaimsUserMapper` no longer maps `sub` by default — re-add it to `idClaims` if needed.

**Note (v0.6.0):** `Hs256JwtVerifier` was rewired to use `Crypto::equals()` and `Crypto::base64UrlDecode()` internally. Public behavior is unchanged.

---

## Skill: Cache GET responses with ETag

**When:** The user wants HTTP-level cacheability with `If-None-Match` / `304 Not Modified`.

**Steps:**
1. Instantiate `ETagMiddleware`.
2. Add it to a route or group.

**Example:**
```php
use BetterRoute\Middleware\Cache\ETagMiddleware;

$etag = new ETagMiddleware(weak: false);

$router->get('/profile/{id}', $handler)
    ->middleware([$etag]);
```

**Rules:**
- Only applies to `GET` and `HEAD` requests.
- Hash is computed from the response body unless an `etagResolver` callable is provided.
- Returns `304` (no body) when `If-None-Match` matches the computed ETag (or `*`).

---

## Skill: Resolve the client IP behind proxies (legacy + v0.6.0)

**When:** The user is behind Cloudflare / a load balancer and needs the real client IP for rate limiting, logging, or audit.

**Legacy API (v0.3.0+):**
```php
use BetterRoute\Http\ClientIpResolver;

$resolver = new ClientIpResolver(
    trustedProxies: ['127.0.0.1', '10.0.0.5'],
    trustedHeaders: ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR']
);

$ip = $resolver->resolve();
```

**Hardened API (v0.6.0):**
```php
use BetterRoute\Middleware\Network\TrustedProxyClientIpResolver;

$resolver = new TrustedProxyClientIpResolver(
    trustedProxyCidrs: ['173.245.48.0/20', '103.21.244.0/22'],
    forwardedHeaders: ['CF-Connecting-IP', 'X-Forwarded-For']
);

$ip = $resolver->resolve();
```

**Rules:**
- New code should prefer `TrustedProxyClientIpResolver` — it understands IPv6 CIDRs natively and implements `ClientIpResolverInterface`.
- The legacy `Http\ClientIpResolver` keeps its constructor and `resolve(?array $server = null)` API; internally it now delegates to the hardened resolver.
- Forwarded headers are honoured **only** when `REMOTE_ADDR` is inside a trusted CIDR. Otherwise `REMOTE_ADDR` is returned and the headers are ignored.
- `RateLimitMiddleware` accepts either resolver in its `clientIpResolver` constructor argument.

---

## Skill: Use the WP object cache for rate limiting

**When:** The user wants in-memory rate limiting on a host with a persistent object cache.

**Example:**
```php
use BetterRoute\Middleware\RateLimit\RateLimitMiddleware;
use BetterRoute\Middleware\RateLimit\WpObjectCacheRateLimiter;

$middleware = new RateLimitMiddleware(
    new WpObjectCacheRateLimiter(group: 'myapp_rl'),
    limit: 60,
    windowSeconds: 60
);
```

**Rules:**
- Throws `RuntimeException` at construction if `wp_cache_*` functions are unavailable.
- Use `TransientRateLimiter` as a fallback when no object cache is configured.

---

## Skill: Persist idempotency state in `wpdb`

**When:** The user wants idempotency that survives object-cache flushes.

**Steps:**
1. Instantiate `WpdbIdempotencyStore` with a table name (default: `better_route_idempotency`).
2. Call `installSchema()` once (typically on plugin activation).
3. Inject into `IdempotencyMiddleware`.

**Example:**
```php
use BetterRoute\Middleware\Write\IdempotencyMiddleware;
use BetterRoute\Middleware\Write\WpdbIdempotencyStore;

register_activation_hook(__FILE__, function (): void {
    (new WpdbIdempotencyStore())->installSchema();
});

$store = new WpdbIdempotencyStore();
$middleware = new IdempotencyMiddleware($store, ttlSeconds: 600, requireKey: true);
```

**Rules:**
- Cross-database table names (containing `.`) are rejected.
- Schema includes a TTL index; expired rows are pruned on access.

---

## Skill: Configure idempotency on write endpoints

**When:** The user wants to prevent duplicate writes (double-submit protection).

**How it works:**
- Client sends `Idempotency-Key: <unique-key>` header with POST/PUT/PATCH requests.
- If the same key was seen within the TTL, the cached response is returned without re-executing the handler.

**Example:**
```php
\BetterRoute\BetterRoute::wooRouteRegistrar()
    ->register('myapp/v1', [
        'idempotency' => [
            'enabled'    => true,
            'requireKey' => true,
            'ttlSeconds' => 600,
        ],
    ]);
```

**Rules (v0.3.0):**
- The default key is identity-aware: `{provider}:user:{userId}` → `{provider}:sub:{subject}` → `'guest'`. Pass an explicit `keyResolver` to preserve pre-v0.3.0 keys.
- Use `WpdbIdempotencyStore` instead of the default array store for cross-request persistence.
- `requireKey: true` makes missing `Idempotency-Key` headers fail with `400 idempotency_key_required`.

**Choose between replay and atomic (v0.5.0):**
- `IdempotencyMiddleware` writes the cached response **after** the handler runs. Two concurrent retries can both reach the handler.
- `AtomicIdempotencyMiddleware` reserves the key **before** handler execution and returns `409 idempotency_in_progress` for concurrent retries. Use it whenever running the handler twice would charge a customer twice, send two emails, or push two webhooks.

---

## Skill: Configure atomic idempotency for side-effectful writes (v0.5.0)

**When:** The user has a write endpoint where concurrent duplicate execution would cause real-world harm (payments, notifications, external API calls, customer-visible mutations).

**Steps:**
1. Run `(new WpdbAtomicIdempotencyStore())->installSchema()` once on plugin activation. The table is separate from the existing `WpdbIdempotencyStore` table.
2. Attach `AtomicIdempotencyMiddleware` to the route or group.
3. Place it inside the auth boundary (after auth middleware, before the handler).

**Example:**
```php
use BetterRoute\Middleware\Write\AtomicIdempotencyMiddleware;
use BetterRoute\Middleware\Write\WpdbAtomicIdempotencyStore;

register_activation_hook(__FILE__, function (): void {
    (new WpdbAtomicIdempotencyStore())->installSchema();
});

$store = new WpdbAtomicIdempotencyStore();

$router->post('/actions/charge', $handler)
    ->middleware([
        new AtomicIdempotencyMiddleware(
            store: $store,
            ttlSeconds: 900,
            requireKey: true
        ),
    ])
    ->protectedByMiddleware('bearerAuth');
```

**Behavior:**
- First request with key K, fingerprint F: reserves `(K, F)`, runs handler, stores response.
- Concurrent identical request: `409 idempotency_in_progress`.
- Later identical request after completion: replays response with `Idempotency-Replayed: true`.
- Same K, different fingerprint: `409 idempotency_conflict`.
- Handler throws (default `releaseOnThrowable: true`): reservation removed, client may retry.
- Missing `Idempotency-Key` with `requireKey: true`: `400 idempotency_key_required`.

---

## Skill: Apply ownership guards (v0.5.0)

**When:** The user has authenticated routes where each user may only access their own row (account orders, profiles, customer records). Capability checks alone are too coarse.

**Two surfaces:**
- **Raw Router routes:** `OwnershipGuardMiddleware`. The resolver receives the full `RequestContext`.
- **Resource DSL:** `OwnedResourcePolicy::currentUserOwns()`. The resolver receives the resolved integer `id` from the URL.

**Route-level example:**
```php
use BetterRoute\Middleware\Auth\OwnershipGuardMiddleware;

$router->get('/account/orders/(?P<id>\d+)', $handler)
    ->middleware([
        new OwnershipGuardMiddleware(
            ownerResolver: static fn ($ctx): ?int => resolve_order_owner_id($ctx->request),
            bypassCapability: 'manage_woocommerce',
            deniedStatus: 404
        ),
    ])
    ->protectedByMiddleware('bearerAuth');
```

**Resource example:**
```php
use BetterRoute\Resource\OwnedResourcePolicy;

Resource::make('records')
    ->restNamespace('myapp/v1')
    ->sourceTable('app_records', 'id')
    ->policy(OwnedResourcePolicy::currentUserOwns(
        ownerResolver: static fn (int $id): ?int => resolve_record_owner_id($id),
        ownedActions: ['get', 'update', 'delete'],
        bypassCapability: 'manage_options',
        allowListForAuthenticatedUsers: true
    ))
    ->register();
```

**Rules:**
- Return `null` (not `0`) from the resolver when the resource does not exist.
- Default `deniedStatus: 404` does not leak existence. Use `403` only when the route already discloses existence by other means.
- The Resource policy authorizes; it does not narrow the result set. For `list`, also filter rows to the current user in the data layer.
- Identity comes from `auth.userId`, then `auth.subject`, then `get_current_user_id()` fallback.

---

## Skill: Configure CORS for browser/mobile clients (v0.5.0)

**When:** The API is called from a browser SPA, mobile webview, or a partner front-end on a different origin.

**Steps:**
1. Build a `CorsPolicy` with the allowed origins, credentials flag, and any custom header lists.
2. Add `CorsMiddleware` as the **first** middleware in the pipeline so preflight `OPTIONS` requests short-circuit before auth.
3. Register explicit `OPTIONS` routes for paths that the browser will preflight using `Router::options()`.

**Example:**
```php
use BetterRoute\Middleware\Cors\CorsMiddleware;
use BetterRoute\Middleware\Cors\CorsPolicy;

$router->middleware([
    new CorsMiddleware(new CorsPolicy(
        allowedOrigins: ['https://app.example.com'],
        allowCredentials: true
    )),
]);

$router->options('/account/orders/(?P<id>\d+)', static fn () => null);
```

**Rules:**
- `['*']` with `allowCredentials: true` echoes the request origin back instead of `*`.
- Disallowed origins fail with `403 cors_origin_denied` unless `rejectDisallowedOrigins: false` is passed.
- Place `CorsMiddleware` before auth — preflight requests do not carry `Authorization`.

---

## Skill: Enrich audit events (v0.5.0)

**When:** The user wants audit events to carry auth provider/user/subject, hashed idempotency keys, and optional client IP without modifying handlers.

**Steps:**
1. Add `AuditEnricherMiddleware` **after** auth middleware (so `auth` attribute is populated) and **before** `AuditMiddleware`.
2. Pass static fields (e.g. `['resource' => 'account']`) for fixed metadata.
3. Set `includeClientIp: true` only when you have a configured `ClientIpResolver` (trusted proxies set up).

**Example:**
```php
use BetterRoute\Middleware\Audit\AuditEnricherMiddleware;
use BetterRoute\Middleware\Audit\AuditMiddleware;

$router->middleware([
    // ... auth middleware here ...
    new AuditEnricherMiddleware(
        staticFields: ['resource' => 'account', 'channel' => 'public-client'],
        includeClientIp: true
    ),
    new AuditMiddleware($logger),
]);
```

**Rules:**
- Order: auth → enricher → audit. Enricher before auth means `authUserId` is missing.
- Keep `staticFields` payloads safe to ship to a log aggregator — no raw tokens or PII.

---

## Skill: Export OpenAPI document

**When:** The user wants to generate an OpenAPI 3.1.0 JSON schema for their API.

**Steps:**
1. Collect contracts from the router via `$router->contracts()`.
2. Call `BetterRoute::openApiExporter()->export($contracts, $options)`.
3. Optionally merge WooCommerce component schemas via `BetterRoute::wooOpenApiComponents()`.

**Example:**
```php
$exporter = \BetterRoute\BetterRoute::openApiExporter();
$contracts = $router->contracts();

$document = $exporter->export($contracts, [
    'title'         => 'My API',
    'version'       => 'v0.6.0',
    'strictSchemas' => true,
    'components'    => \BetterRoute\BetterRoute::wooOpenApiComponents(),
    'securitySchemes' => [
        'bearerAuth' => [
            'type'         => 'http',
            'scheme'       => 'bearer',
            'bearerFormat' => 'JWT',
        ],
    ],
    'globalSecurity' => [
        ['bearerAuth' => []],
    ],
]);

header('Content-Type: application/json');
echo json_encode($document, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
```

**Rules:**
- `strictSchemas: true` throws `InvalidArgumentException` if a `$ref` points to an unknown component.
- `strictSchemas: false` (default) preserves the v0.2.0 forgiving behavior.

---

## Skill: Publish an `openapi.json` endpoint

**When:** The user wants the OpenAPI document served as a live REST endpoint.

**Example:**
```php
use BetterRoute\OpenApi\OpenApiRouteRegistrar;

OpenApiRouteRegistrar::register(
    restNamespace: 'myapp/v1',
    contractsProvider: static fn (): array => $router->contracts(openApiOnly: true),
    options: [
        'title'   => 'My API',
        'version' => 'v0.6.0',
        // To make the doc public, override the admin-only default (since v0.3.0):
        'permissionCallback' => static fn (): bool => true,
    ]
);
```

**Rules (v0.3.0):**
- Default permission is `current_user_can('manage_options')`.
- The endpoint path is `/openapi.json` under the namespace.

---

## Skill: Query WooCommerce list endpoints

**When:** The user or agent needs to retrieve filtered, paginated lists from WooCommerce endpoints.

**Common patterns:**

```
GET /wp-json/vendor/v1/woo/orders?status=processing&sort=-date_created&page=1&per_page=50
GET /wp-json/vendor/v1/woo/products?type=simple&stock_status=instock&fields=id,name,price
GET /wp-json/vendor/v1/woo/customers?role=customer&search=john&sort=email
GET /wp-json/vendor/v1/woo/coupons?code=SUMMER25&fields=id,code,amount,discount_type
```

**Rules:**
- Unknown query parameters return `400`.
- `fields` is always comma-separated.
- Sort prefix `-` means DESC, no prefix means ASC.
- `per_page` is capped at the configured `maxPerPage` (default 100).
- Pagination headers: `X-WP-Total`, `X-WP-TotalPages`.
- Customer endpoints: only users with the `customer` role are returned.

---

## Skill: Handle metadata

**When:** The user needs to read or write custom metadata on WooCommerce entities.

**Format:**
```json
{
  "meta_data": [
    { "key": "custom_field", "value": "custom_value" },
    { "key": "another_field", "value": 42 }
  ]
}
```

**Rules:**
- `key` must be a non-empty string.
- `value` can be any JSON-serializable type.
- On update, `meta_data` entries are applied via `update_meta_data()` — existing keys are overwritten, new keys are added.
- Metadata in responses includes an `id` field (the meta entry ID).
- **v0.3.0:** keys starting with `_` (underscore) are not writable and not returned by default. Pass `$allowProtected = true` only when the caller has business reason to touch protected meta.

---

## Skill: Understand the error contract

**When:** The agent needs to interpret or handle API errors.

**Default envelope:**
```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable message",
    "requestId": "unique-request-id",
    "details": {}
  }
}
```

**OAuth RFC 6749 envelope (v0.6.0, route opt-in):**
```json
{
  "error": "invalid_request",
  "error_description": "Invalid request."
}
```

Routes opt in via `meta(['error_format' => 'oauth_rfc6749'])`. `internal_error` is rewritten to `server_error` for 5xx responses on those routes.

**Common error codes:**
- `400` — `validation_failed`, `invalid_request`, `idempotency_key_required`, `single_use_token_required` *(v0.6.0)*
- `401` — `invalid_token`, `unauthorized`, `invalid_signature` *(v0.6.0)*, `signature_required` *(v0.6.0)*, `stale_signature` *(v0.6.0)*, `invalid_signature_timestamp` *(v0.6.0)*, `invalid_single_use_token` *(v0.6.0)*
- `403` — `forbidden`, `cors_origin_denied` *(v0.5.0)*, `client_ip_unavailable` *(v0.6.0)*, `client_ip_not_allowed` *(v0.6.0)*
- `404` — resource not found
- `409` — `idempotency_conflict`, `idempotency_in_progress` *(v0.5.0)*, `single_use_token_reused` *(v0.6.0)*, `hpos_required`, duplicate email
- `412` — `precondition_failed`, `optimistic_lock_failed`
- `429` — `rate_limited`
- `503` — `woo_unavailable`

**Rules (v0.3.0):**
- For `status >= 500` from non-`ApiException` failures, the message is normalized to `"Unexpected error."` and `details` is empty — internal exception class and message no longer leak.
- For `status === 400` from non-`ApiException` failures, `details.exception` still includes the class name (developer aid for misuse).
- Validation failures (`validation_failed`) include `details.fieldErrors` mapping each invalid field to its error messages.
