---
title: AI Agent Skills
sidebar_position: 99
---

This page highlights the most important structured skills an AI agent needs to work with the `better-route` library, aligned with the **v1.1.0** release. See [Release Notes — v1.1.0](release-notes/v1.1.0) for the full changelog and [v1.0.0](release-notes/v1.0.0) for the previous baseline.

:::info Canonical skills home
The complete, maintained skill set lives in one place: **[Lonsdale201/wp-agent-skills → better-route](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route)** — 23 task-scoped skills covering routing, resources, auth, write safety, public clients, OpenAPI, and WooCommerce. This page keeps only the highlights inline; everything else is linked from the [skill index](#full-skill-index) below so the skills are not maintained in two places.
:::

<a className="button button--primary" href="https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route" target="_blank" rel="noopener noreferrer">Browse all skills on GitHub →</a>

## Skill: Install better-route

**When:** The user wants to add `better-route` to a WordPress project.

**Requirements:**
- PHP `^8.1`
- WordPress with REST API (`rest_api_init` hook)
- Composer
- OpenSSL extension (for `Rs256JwksJwtVerifier` — v0.6.0)

**Install:**
```bash
composer require better-route/better-route:^1.1
```

Only add a VCS `repositories` entry (pointing at `https://github.com/Lonsdale201/better-route`) if you need to track an unreleased branch or a fork.

**Rules:**
- Plain `composer require` works — no `repositories` block needed since v1.0.0.
- All route registration must happen inside a `rest_api_init` action hook — since v1.1.0 the default dispatcher **throws** outside of it.
- Available quality commands: `composer test`, `composer analyse`, `composer cs-check`.

Full version: [br-install-and-migrate](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-install-and-migrate)

---

## Skill: Migrate a project to v1.1.0

**When:** The user is upgrading from v1.0.0 (or earlier) to v1.1.0.

**Steps:**
1. Bump the constraint to `^1.1` and run `composer update better-route/better-route`.
2. **Add explicit intent to every raw `Router` route.** `GET` and `OPTIONS` routes without `->permission()`, `->protectedByMiddleware()`, or `->publicRoute()` now return `403` (write methods have denied since v0.4.0). This is the one change that will break previously-working reads.
3. **Remove explicit preflight `OPTIONS` routes** (or give the ones you keep explicit intent) — the WordPress CORS bridge answers preflight for every route carrying `CorsMiddleware`, before dispatch.
4. Review the write-safety defaults: failed atomic-idempotency requests now stay reserved until TTL (`releaseOnThrowable` defaults to `false`), `ArrayAtomicIdempotencyStore` is tests-only, and optimistic locking runs in a MySQL advisory-lock critical section.
5. If you configure `maxLifetimeSeconds` on a JWT verifier, ensure the issuer emits **both `iat` and `exp`** — tokens missing either are now rejected.
6. `WpObjectCacheRateLimiter` now throws without a persistent external object cache — switch to `TransientRateLimiter` on default hosting.
7. WooCommerce: `'actions' => []` now disables a resource (previously fell back to the full set); the registrar installs a durable wpdb idempotency store by default; strict payload validation rejects unknown nested keys with `400`.
8. Walk the full [v1.1.0 behavior change checklist](release-notes/v1.1.0#behavior-change-checklist). For older upgrades, the v1.0.0 / v0.5.0 / v0.4.0 / v0.3.0 checklists live in their [release notes](release-notes/v1.0.0).

**Verification:**
- Every endpoint that should be public still responds `200` — grep for raw routes without `permission|protectedByMiddleware|publicRoute`.
- Browser clients still pass preflight (the bridge responds `204` with the policy headers).
- Idempotent writes and coupon-code updates behave under concurrency (`409 idempotency_in_progress`, `409 coupon_write_in_progress`).

Full version: [br-install-and-migrate](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-install-and-migrate)

---

## Skill: Register custom REST routes

**When:** The user wants to create custom REST endpoints (non-WooCommerce).

**Steps:**
1. Create a `Router` via `BetterRoute::router('vendor', 'v1')`.
2. Use `->get()`, `->post()`, `->put()`, `->patch()`, `->delete()` to define routes.
3. **Declare intent on every route** with `->permission()`, `->protectedByMiddleware()`, or `->publicRoute()` — since v1.1.0 all methods (including `GET`/`OPTIONS`) deny by default.
4. Register inside a `rest_api_init` action hook (throws outside of it since v1.1.0).

**Example:**
```php
add_action('rest_api_init', function () {
    $router = \BetterRoute\BetterRoute::router('myapp', 'v1');

    $router->get('/ping', function ($context) {
        return \BetterRoute\Http\Response::ok(['pong' => true]);
    })
        ->publicRoute();

    $router->post('/articles', $createArticle)
        ->permission(static fn () => current_user_can('edit_posts'));

    $router->post('/secure/articles', $createArticle)
        ->protectedByMiddleware('bearerAuth');

    $router->post('/webhooks/intake', $intake)
        ->publicRoute();

    $router->register();
});
```

**Rules (v1.1.0):**
- Raw `Router` routes without an explicit permission callback **deny by default** at the WordPress permission layer — every HTTP method, `GET` and `OPTIONS` included (write methods since v0.4.0).
- `->protectedByMiddleware($security = null)` defers authorization to the better-route middleware pipeline.
- `->publicRoute()` marks the route as intentionally public and clears OpenAPI `security` for the operation.
- `register()` fails loudly outside `rest_api_init` or when WordPress core rejects a route.
- Static `[Controller::class, 'method']` handlers are supported without instantiation; handler classes requiring constructor arguments must be passed as instances.

**Rules (v0.3.0):**
- Route handlers receive `id` from the URL route parameters first; query/body `id` is only consulted if the URL does not provide one.
- Inbound `X-Request-ID` is accepted only if it matches `^[A-Za-z0-9._:-]{1,128}$`; otherwise a fresh id is generated.

Full version: [br-routes](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-routes)

---

## Skill: Configure atomic idempotency for side-effectful writes

**When:** The user has a write endpoint where concurrent duplicate execution would cause real-world harm (payments, notifications, external API calls, customer-visible mutations).

**Steps:**
1. Run `(new WpdbAtomicIdempotencyStore())->installSchema()` once on plugin activation — since v1.1.0 it both creates and migrates the table (lease-token column). The table is separate from the existing `WpdbIdempotencyStore` table.
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

**Behavior (v1.1.0):**
- First request with key K, fingerprint F: reserves `(K, F)` under an unforgeable lease token, runs handler, stores the response via data-only serialization (`StoredResponseCodec`).
- Concurrent identical request: `409 idempotency_in_progress`.
- Later identical request after completion: replays response with `Idempotency-Replayed: true`.
- Same K, different fingerprint (deep-canonical, `Support\Canonicalizer`): `409 idempotency_conflict`.
- Handler throws: the reservation is **kept until TTL expiry by default** (`releaseOnThrowable: false` since v1.1.0) so an uncertain side effect cannot run twice; retry deliberately with a new key.
- Missing `Idempotency-Key` with `requireKey: true`: `400 idempotency_key_required`. Keys longer than `maxKeyLength` (default 200): `400 idempotency_key_invalid`.
- `ArrayAtomicIdempotencyStore` is for tests only — use the wpdb store (or your own `LeaseAwareAtomicIdempotencyStoreInterface`) in production.

Full version: [br-atomic-idempotency](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-atomic-idempotency)

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
- `400` — `validation_failed`, `invalid_request`, `idempotency_key_required`, `idempotency_key_invalid` *(v1.1.0)*, `single_use_token_required` *(v0.6.0)*
- `401` — `invalid_token`, `unauthorized`, `invalid_signature` *(v0.6.0)*, `signature_required` *(v0.6.0)*, `stale_signature` *(v0.6.0)*, `invalid_signature_timestamp` *(v0.6.0)*, `invalid_single_use_token` *(v0.6.0)*
- `403` — `forbidden`, `cors_origin_denied` *(v0.5.0; since v1.1.0 also emitted on preflight by the WordPress CORS bridge)*, `client_ip_unavailable` *(v0.6.0)*, `client_ip_not_allowed` *(v0.6.0)*
- `404` — resource not found
- `409` — `idempotency_conflict`, `idempotency_in_progress` *(v0.5.0)*, `single_use_token_reused` *(v0.6.0)*, `coupon_exists`, `coupon_write_in_progress` *(v1.1.0)*, duplicate email
- `412` — `precondition_failed`, `optimistic_lock_failed`
- `428` — `precondition_required` *(v1.0.0; missing optimistic-lock precondition)*
- `429` — `rate_limited` *(carries `Retry-After` and `X-RateLimit-*` headers since v1.1.0)*
- `503` — `hpos_required` *(v1.0.0, was `409`)*, `woo_unavailable`

**Rules:**
- For `status >= 500` from non-`ApiException` failures, the message is normalized to `"Unexpected error."` and `details` is empty — internal exception class and message never leak.
- For `status === 400` from non-`ApiException` failures, `details.exception` still includes the class name (developer aid for misuse).
- Validation failures (`validation_failed`) include `details.fieldErrors` mapping each invalid field to its error messages.
- *(v1.1.0)* `WP_Error` details are allowlisted before entering the envelope, and response/error headers are validated against header injection.

Full version: [br-error-contract](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-error-contract)

---

## Full skill index

Everything below is maintained in the [wp-agent-skills repository](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route) — link the agent there instead of duplicating instructions here.

| Domain | Skills |
|---|---|
| **Routing & core** | [br-routes](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-routes) · [br-error-contract](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-error-contract) · [br-install-and-migrate](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-install-and-migrate) |
| **Resources** | [br-resource-cpt](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-resource-cpt) · [br-resource-table](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-resource-table) · [br-resource-policy](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-resource-policy) · [br-write-schema](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-write-schema) · [br-owned-resource-guards](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-owned-resource-guards) |
| **Auth & identity** | [br-auth-middleware](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-auth-middleware) · [br-jwks-jwt-auth](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-jwks-jwt-auth) · [br-hmac-signature](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-hmac-signature) · [br-single-use-token](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-single-use-token) · [br-crypto](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-crypto) |
| **Write safety** | [br-atomic-idempotency](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-atomic-idempotency) · [br-idempotency](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-idempotency) · [br-optimistic-locking](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-optimistic-locking) |
| **Public clients & network** | [br-cors-public-client](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-cors-public-client) · [br-rate-limiting](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-rate-limiting) · [br-etag-cache](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-etag-cache) · [br-network-security](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-network-security) · [br-audit-enrichment](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-audit-enrichment) |
| **OpenAPI & WooCommerce** | [br-openapi](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-openapi) · [br-woo-routes](https://github.com/Lonsdale201/wp-agent-skills/tree/main/better-route/br-woo-routes) |
