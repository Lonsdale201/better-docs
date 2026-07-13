---
title: HMAC Request Signatures
---

`HmacSignatureMiddleware` *(v0.6.0)* validates a signed request before the handler runs. Use it for server-to-server webhooks where the caller and the API share a secret per key id.

The signature is verified, the timestamp is enforced against a replay window, and the active key id is recorded into request attributes — all before the handler decides anything.

## Minimal example

```php
use BetterRoute\Middleware\Auth\ArrayHmacSecretProvider;
use BetterRoute\Middleware\Auth\HmacSignatureMiddleware;

$secrets = new ArrayHmacSecretProvider([
    'kid-2026-prod' => $_ENV['HMAC_SECRET_PROD'],
    'kid-2026-canary' => $_ENV['HMAC_SECRET_CANARY'],
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

`->publicRoute()` declares the route as intentionally public (no `permission()` callback) so WordPress lets it through. The signature middleware is the actual gate.

## Constructor

```php
new HmacSignatureMiddleware(
    HmacSecretProviderInterface $secrets,
    string $signatureHeader = 'X-Signature',
    string $timestampHeader = 'X-Timestamp',
    string $keyIdHeader = 'X-Key-Id',
    int $replayWindowSeconds = 300,
    string $algorithm = 'sha256',
    ?callable $now = null,
    bool $signQueryString = false
);
```

- `algorithm` must be a member of `hash_hmac_algos()`. Defaults to `sha256`.
- `replayWindowSeconds` must be positive. Both past and future drift outside the window fail closed.
- Inject a `$now` callable in tests.
- `signQueryString` *(since 1.0.0)* — when `true`, the canonicalized query string is appended to the signed canonical (see below). Defaults to `false`.

## Canonical input

Every request is reduced to a single string before HMAC:

```text
timestamp + "\n" + method + "\n" + path + "\n" + sha256(body)
```

- `timestamp` — the integer Unix epoch from the timestamp header.
- `method` — uppercased HTTP method.
- `path` — URL path of the request (no scheme/host, no query string).
- `sha256(body)` — hex digest of the raw request body. Use an empty body for `GET`/`DELETE`.

The client signs the same canonical string with the shared secret and sends the result in `X-Signature`.

**Since 1.0.0 — optional query-string signing.** By default the query string is **not** authenticated, so send any security-relevant parameter in the request body. Set `signQueryString: true` to append a fifth line with the canonicalized query string:

```text
timestamp + "\n" + method + "\n" + path + "\n" + sha256(body) + "\n" + canonicalQuery
```

`canonicalQuery` is the request's query parameters sorted by key (recursively, via `ksort`) and re-encoded with `http_build_query` (empty string when there are no query params). The client's signer must produce the same canonical query line.

## Accepted signature encodings

The middleware accepts any of the following representations and compares them in constant time via `Crypto::equals()`:

- lowercase hex
- uppercase hex
- base64
- base64url (no padding)
- the same four values prefixed with `sha256=` (e.g. `sha256=ab12...`)

This matches the formats produced by Stripe-style and GitHub-style webhook signers without forcing one shape.

## Behavior

| Failure | Status | Code |
|---|---|---|
| Missing/blank `X-Signature` / `X-Timestamp` / `X-Key-Id` | `401` | `signature_required` |
| Timestamp not numeric | `401` | `invalid_signature_timestamp` |
| Timestamp outside `±replayWindowSeconds` | `401` | `stale_signature` |
| Unknown key id (provider returns `null`/empty) | `401` | `invalid_signature` |
| Computed HMAC does not match any accepted encoding | `401` | `invalid_signature` |

On success, the middleware writes safe metadata into the request context:

```php
$context->attributes['hmac'] === [
    'keyId' => 'kid-2026-prod',
    'algorithm' => 'sha256',
];
```

*(v1.1.0)* The middleware also records the shared auth identity (`auth` attribute with `provider: 'hmac'`, `subject: <keyId>`), so identity-scoped middleware — rate limiting, caching, idempotency — keys on the HMAC key id instead of treating the caller as an anonymous IP.

The raw secret is never reflected.

## Secret providers

`HmacSecretProviderInterface` is a one-method contract:

```php
interface HmacSecretProviderInterface
{
    public function secretFor(string $keyId): ?string;
}
```

`ArrayHmacSecretProvider` is a static map for the simple case. For production rotation, build a custom provider that reads from your secret store (Vault, AWS Secrets Manager, encrypted options, ...) and returns the matching secret per key id.

## Key rotation

Use distinct `kid` values per active secret:

```php
$secrets = new ArrayHmacSecretProvider([
    'kid-2026-q1' => $_ENV['HMAC_SECRET_Q1'],
    'kid-2026-q2' => $_ENV['HMAC_SECRET_Q2'],
]);
```

Rotate by:

1. issue the new secret on a new `kid`;
2. update the consumer to start signing with the new `kid`;
3. wait for traffic on the old `kid` to drain;
4. remove the old `kid` from the provider.

The middleware fails closed for unknown key ids, so removing a `kid` immediately invalidates anything still using it.

## Combining with other middleware

- Place `HmacSignatureMiddleware` **before** rate limiting so unauthenticated traffic does not consume the limit budget. *(v1.1.0)* With this order the rate limiter automatically scopes per HMAC key id via the shared auth identity.
- Combine with `IpAllowlistMiddleware` to restrict to known proxy networks (e.g. the partner's outbound CIDRs).
- HMAC routes are usually `->publicRoute()` from WordPress's perspective. The middleware is the actual auth.

## Validation checklist

- request signed with the expected secret returns `200`;
- request with a stale timestamp returns `401 stale_signature`;
- request with a tampered body returns `401 invalid_signature`;
- request with an unknown `X-Key-Id` returns `401 invalid_signature` (does not leak which key ids exist);
- successful requests carry `hmac.keyId` in attributes.

## Common mistakes

- Hashing the request after it has been mutated by a body parser. Always compute `sha256(body)` over the **raw** wire bytes.
- Assuming the query string is authenticated. By default it is not — send signed parameters in the body, or enable `signQueryString: true` (since 1.0.0) and have your client sign the matching canonical query line.
- Letting clocks drift more than `replayWindowSeconds` between issuer and verifier — `stale_signature` errors point here first.
- Reusing a single shared secret across many partners. Use distinct `kid`s so revocation is per-partner.
