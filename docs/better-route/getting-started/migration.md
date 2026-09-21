---
title: Upgrade to 1.1.1
---

Better Route 1.1.1 fixes existing APIs. The Composer package version, your REST namespace (such as `myapp/v1`), and your OpenAPI `info.version` are independent. Updating the package does not rename routes. Review changes to your own response schemas and permissions separately.

## Coordinate idempotent writers

Default response-cache keys and both classic and atomic idempotency keys/fingerprints now include the router namespace, route template, concrete request path, and separately captured URL parameters. Query/body parameters can no longer hide a URL ID from this scope. `RequestContext::routePath` remains the registered template; the router supplies `attributes['routeNamespace']`.

Old response-cache entries become cold and expire normally. Old default idempotency records cannot be safely translated because they lack the original namespace and target. There is no legacy replay fallback. Upgrading from 1.1.0 requires no table-schema change.

Before updating any deployment that uses either idempotency middleware:

1. Pause affected writers, client retries, webhook deliveries and retry queues. Drain in-flight requests.
2. Reconcile uncertain operations against business records. Complete or retire old retries before changing keys. Waiting for the record TTL alone is insufficient: account for the entire client retry horizon.
3. Deploy every web and worker process together, then restart long-running workers. Do not mix old and new default key schemes.
4. Verify identical replay and changed-payload conflict before resuming new operations. Retain business-level deduplication for payments and other irreversible effects.

Clearing old records does not replace reconciliation. Rollback crosses the same key boundary and requires the same procedure. Custom resolvers own namespace, URL, identity and tenant isolation; a custom key resolver alone still uses the changed default fingerprint.

Keep authentication before caching/idempotency. Rate-limit buckets, optimistic-lock scope and single-use token semantics are unchanged by this patch.

## Authentication scope

JWT, Bearer and Application Password middleware restore the previous native WordPress user in `finally`, on success and exceptions. Nested calls unwind their identities. Verified JWT/Bearer identities without a positive WP mapping run downstream as native user `0`.

`AuthContext::withIdentity()` replaces `userId`, `user`, `claims` and `scopes`, including null/empty values. Attribute presence alone does not prove a mapped user exists. Custom `setCurrentUser` adapters should provide the appended optional `getCurrentUser` callback for the same identity store. Existing positional arguments are unchanged.

This scope ends when the downstream pipeline returns. `rest_request_after_callbacks`, `rest_post_dispatch` and later `_embed` requests see the restored caller. Perform protected work inside the pipeline, or use WordPress request authentication (for example native Application Password authentication) when response filters/embedding need that identity. Do not disable permission checks or leave a global user set.

WordPress permission callbacks run before Better Route middleware. `protectedByMiddleware()` only declares intent; attach real authentication and authorization middleware.

## WooCommerce integration changes

- Billing/shipping-only writes recalculate taxes and totals, including on paid orders. Address changes can therefore change the amount.
- Gateways initialize before writes. Requested status changes are staged after item/tax calculations, so status hooks see final totals.
- Save precedes payment completion. On updates, `set_paid: true` calls `payment_complete()` only if the order still needs payment. Repeating it on a paid order does not repeat the event. Sending an already-paid status with `set_paid` does not guarantee a payment-complete event, and the flag is not evidence of external payment capture.
- Database transactions cannot undo emails, webhooks or other external effects triggered by hooks.
- Order line quantities must be positive finite numbers. Product stock accepts finite numbers (including negative values) or `null`. Better Route no longer truncates fractions to integers.
- Writes reject quantities that `wc_stock_amount()` would change with `400 validation_failed`. Fractional stores must retain their fractional Woo configuration for later reads too: Woo normalizes quantities when loading items. Better Route does not bypass the data store to recover fractions after configuration changes.
- OpenAPI quantity schemas now use `number`; line-item input has `exclusiveMinimum: 0`, and product stock permits `null`. Review/regenerate typed clients.

The Woo registrar still provides administrative CRUD for orders, products, customers and coupons. This patch adds no Store API, cart, checkout or refund endpoints.

## Upgrading from 1.0.x or earlier

Apply the [1.1.0 behavior checklist](../release-notes/v1.1.0#behavior-change-checklist) as well as the coordination steps above. In particular, declare access intent on every raw route and migrate the atomic store's `reservation_token` column with `installSchema()` before serving traffic. The schema migration belongs to 1.1.0; 1.1.1 changes request keys without another schema change.

## Verify your integration

Check namespace/URL isolation, identical/concurrent replay, payload conflicts, mapped/unmapped user restoration (including exceptions and nested calls), later response filters/embedding, order status totals, address-only tax changes, repeated `set_paid`, and fractional quantity reads/writes under the supported Woo configuration. Use an authorized test installation and keep credentials and run evidence outside public repositories.

See the versioned [library migration guide](https://github.com/Lonsdale201/better-route/blob/v1.1.1/MIGRATING.md) and [1.1.1 release notes](../release-notes/v1.1.1).
