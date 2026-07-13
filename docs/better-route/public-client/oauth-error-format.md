---
title: OAuth Error Format
---

Routes that wrap an OAuth surface — `/oauth/token`, `/oauth/authorize`, `/oauth/revoke` — need to emit OAuth RFC 6749 style error bodies. The default better-route envelope (`{ "error": { "code": ..., "message": ..., "requestId": ... } }`) is the right contract for application APIs but the wrong contract for OAuth clients.

`OAuthErrorNormalizer` *(v0.6.0)* adds an opt-in error format selectable per route via metadata.

## How to opt in

Set `error_format` on the route's `meta`:

```php
$router->post('/oauth/token', $handler)
    ->meta(['error_format' => 'oauth_rfc6749'])
    ->publicRoute();
```

The flag is route-level. Other routes on the same router keep the default better-route envelope.

## Response shape

```json
{
  "error": "invalid_request",
  "error_description": "Invalid request."
}
```

Optional fields:

- `error_uri` — emitted when the thrown exception's `details` carries an `error_uri` (or `errorUri`) string.
- `request_id` — emitted when `details.requestId === true` is set on the thrown exception. Off by default to match the RFC.

## How it picks codes

| Source | Status | `error` |
|---|---|---|
| `ApiException` with `errorCode` | as-is | `errorCode` |
| `InvalidArgumentException` | `400` | `invalid_request` |
| any other throwable | `500` | `server_error` |
| `WP_Error` | from `data.status` (default `400`; out-of-range values normalize to `400` *(v1.1.0)*) | the WP error code |

`internal_error` is rewritten to `server_error` for `5xx` responses to match the RFC.

Only an `ApiException` message becomes `error_description` verbatim. *(v1.1.0)* Every other throwable is normalized — `"Invalid request."` for `400`, `"Unexpected error."` otherwise — so handler internals never leak. `ApiException` response `headers` are emitted with the OAuth-shaped response too, and `WP_Error` details are allowlisted to the core REST `params` map.

## Worked example: authorization code consumption

```php
use BetterRoute\Http\ApiException;
use BetterRoute\Http\Response;
use BetterRoute\Middleware\Write\SingleUseTokenMiddleware;
use BetterRoute\Middleware\Write\WpdbSingleUseTokenStore;

$singleUse = new SingleUseTokenMiddleware(
    store: new WpdbSingleUseTokenStore(),
    tokenSource: static fn ($req): ?string => (string) $req->get_param('code')
);

$router->post('/oauth/token', static function ($ctx) {
    $codeContext = $ctx->attributes['singleUseToken'] ?? null;
    if ($codeContext === null) {
        throw new ApiException('Authorization code is required.', 400, 'invalid_request');
    }

    // ... validate redirect_uri, client_id, etc. ...
    return Response::ok([
        'access_token' => '...',
        'token_type'   => 'Bearer',
        'expires_in'   => 3600,
    ]);
})
    ->middleware([$singleUse])
    ->meta(['error_format' => 'oauth_rfc6749'])
    ->publicRoute();
```

A second consume of the same code returns OAuth-shaped error:

```json
{
  "error": "single_use_token_reused",
  "error_description": "Single-use token has already been consumed."
}
```

If you want OAuth-mapped codes (`invalid_grant`, `invalid_request`, ...), throw `ApiException` with the desired code from your handler — the normalizer passes the code through unchanged unless it is one of the 5xx remappings above.

## When to use

- routes that mimic an OAuth provider (token, authorize, revoke, introspect);
- routes consumed by OAuth client libraries that parse RFC 6749 responses;
- partner integrations where an OAuth-shaped error is part of the contract.

When in doubt, keep the default better-route envelope. It carries `requestId` and is more useful for application clients.

## Validation checklist

- a route **without** `meta(['error_format' => 'oauth_rfc6749'])` returns the default `{ error: { code, message, requestId, details } }` envelope;
- a route **with** the metadata returns `{ error, error_description }` (no `requestId` unless explicitly enabled);
- a 5xx error on an OAuth-format route returns `error: "server_error"`;
- a `WP_Error` on an OAuth-format route uses the WP error code as `error`.

## Common mistakes

- Setting `error_format` globally. The flag is per-route — emitting OAuth-shaped errors from `/profile` confuses application clients.
- Throwing raw `RuntimeException` for client-visible OAuth errors. Use `ApiException` with the right code (`invalid_grant`, `invalid_client`, ...).
- Expecting the normalizer to map every error to an OAuth code. It only rewrites `internal_error` → `server_error` for 5xx; everything else is passed through.
