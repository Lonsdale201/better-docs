---
title: Error Codes
---

## Common contract

All errors are returned under the better-route envelope unless a route opts into the [OAuth error format](../public-client/oauth-error-format):

- `error.code`
- `error.message`
- `error.requestId`
- `error.details`

## Codes used by built-ins

- `validation_failed` (`400`)
- `invalid_request` (`400`)
- `idempotency_key_required` (`400`)
- `single_use_token_required` (`400`) *(v0.6.0, `SingleUseTokenMiddleware`)*
- `unauthorized` (`401`)
- `invalid_token` (`401`)
- `invalid_credentials` (`401`)
- `invalid_authorization_header` (`401`)
- `invalid_signature` (`401`) *(v0.6.0, `HmacSignatureMiddleware`)*
- `signature_required` (`401`) *(v0.6.0, `HmacSignatureMiddleware`)*
- `stale_signature` (`401`) *(v0.6.0, `HmacSignatureMiddleware`)*
- `invalid_signature_timestamp` (`401`) *(v0.6.0, `HmacSignatureMiddleware`)*
- `invalid_single_use_token` (`401`) *(v0.6.0, `SingleUseTokenMiddleware`)*
- `forbidden` (`403`)
- `insufficient_scope` (`403`)
- `invalid_nonce` (`403`)
- `cors_origin_denied` (`403`) *(v0.5.0, `CorsMiddleware`)*
- `client_ip_unavailable` (`403`) *(v0.6.0, `IpAllowlistMiddleware` with `failClosed: true`)*
- `client_ip_not_allowed` (`403`) *(v0.6.0, `IpAllowlistMiddleware`)*
- `not_found` (`404`)
- `conflict` (`409`)
- `idempotency_conflict` (`409`)
- `idempotency_in_progress` (`409`) *(v0.5.0, `AtomicIdempotencyMiddleware`)*
- `single_use_token_reused` (`409`) *(v0.6.0, `SingleUseTokenMiddleware`)*
- `version_unavailable` (`409`)
- `coupon_exists` (`409`) *(v1.0.0, Woo coupon create — duplicate code)*
- `woo_line_items_locked` (`409`) *(v1.0.0, Woo order — line-item edit on a stock-reduced order)*
- `precondition_failed` (`412`)
- `optimistic_lock_failed` (`412`)
- `precondition_required` (`428`) *(v1.0.0, was `412` — missing optimistic-lock precondition)*
- `rate_limited` (`429`)
- `internal_error` (`500`)
- `hpos_required` (`503`) *(v1.0.0, was `409`; WooCommerce HPOS not enabled)*
- `woo_unavailable` (`503`) *(WooCommerce not available)*

## OAuth error format *(v0.6.0)*

When a route opts in via `meta(['error_format' => 'oauth_rfc6749'])`, the envelope changes shape:

```json
{
  "error": "invalid_request",
  "error_description": "Invalid request."
}
```

`internal_error` is rewritten to `server_error` for 5xx responses on OAuth-format routes. Every other code is passed through unchanged. See [OAuth Error Format](../public-client/oauth-error-format).

## Recommended mapping practice

- use domain-specific `ApiException` codes for predictable client handling
- keep message human-readable and details machine-readable
- always propagate requestId to logs and support workflows
