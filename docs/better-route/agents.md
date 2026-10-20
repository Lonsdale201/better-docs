---
title: AI Agent Guidance
sidebar_position: 99
---

This guidance targets Better Route 1.1.2, PHP 8.1+. Read [migration guidance](getting-started/migration)
before changing an existing integration and [release notes](release-notes/v1.1.2) for the scope.

## Resolve the actual version first

```bash
composer show better-route/better-route
composer require better-route/better-route:^1.1.2
```

The Composer package version, application REST namespace and OpenAPI info.version are
independent. Do not rename an application's routes when updating the library. PHP 8.3-only
features belong to a separate future development line, not the 1.1.2 release.

## Skill discovery and freshness

Use the current skills from your configured knowledge provider. Historical public skill
copies can lag the released source; they are not a substitute for current version checks.
This page provides public usage guidance and links to maintained documentation rather than
duplicating a skill catalog. Teams using the private catalog can route by the names below;
the updated collection contains 24 task-specific skills, including br-woo-analytics.

| Task | Skills | Documentation |
|---|---|---|
| Install, migrate, raw routes | br-install-and-migrate, br-routes | [Install](getting-started/installation), [Migration](getting-started/migration) |
| Resource CRUD and permissions | br-resource-cpt, br-resource-table, br-resource-policy, br-write-schema, br-owned-resource-guards | [Resource API](reference/resource-api) |
| Authentication and network | br-auth-middleware, br-jwks-jwt-auth, br-hmac-signature, br-network-security | [Middleware catalog](reference/middleware-catalog) |
| Write safety | br-idempotency, br-atomic-idempotency, br-optimistic-locking, br-single-use-token | [Migration](getting-started/migration) |
| Browser reads and errors | br-cors-public-client, br-etag-cache, br-rate-limiting, br-error-contract | [Error contract](reference/error-codes) |
| Woo CRUD | br-woo-routes | [Configuration](woocommerce/configuration), [Customers](woocommerce/customers), [Coupons](woocommerce/coupons) |
| Native reports | br-woo-analytics | [Analytics](woocommerce/analytics) |
| Contracts | br-openapi | [OpenAPI](openapi/overview) |
| Observability and crypto | br-audit-enrichment, br-crypto | [Middleware catalog](reference/middleware-catalog) |

## Non-obvious integration rules

- Register during rest_api_init. Every raw route needs explicit permission/public/middleware
  intent; protectedByMiddleware alone does not authenticate or authorize a request.
- WordPress args validation runs before the permission callback. Keep validators cheap and
  side-effect-free. Native pre-handler errors can retain WordPress's error format.
- CustomerRolePolicy applies across list/detail/mutations. Request roles only narrow it;
  privileged targets need explicit trusted opt-in and native mutation capabilities still apply.
- Default customer/coupon DTOs omit metadata. Protect authorization/session keys and coupon
  internal metadata; never replace service-specific guards with a generic metadata helper.
- Coupon state is read-only management information, not checkout eligibility.
- Analytics is manually registered. Preserve native WP identity, upstream report permissions
  and historical import readiness. Unlike Woo CRUD, it rejects `_locale`, `_fields` and context.
- Use strict OpenAPI export and validate serialized JSON. Supply custom schemas and actual
  auth definitions; permission callbacks are not inferred as security schemes. PUT/PATCH IDs
  differ, and ambiguous operations/configuration now fail explicitly.

## Evidence before a release

```bash
composer test
composer analyse
composer cs-check
php tests/openapi/export.php /tmp/better-route-openapi.json
python -m pip install -r tests/openapi/requirements.txt
python tests/openapi/validate.py /tmp/better-route-openapi.json
```

Run native WP/Woo checks against disposable synthetic data and the host's actual auth/cache
stack. The library's CI covers PHP 8.1–8.4, plus WP 6.9.4/Woo 10.9.4 runtime checks on PHP
8.1/8.3 with HPOS/CPT. That is not evidence for every version, external IdP, background
import or third-party extension combination. Report uncovered deployment paths explicitly.
