---
title: Installation
---

## Runtime requirements

- PHP `^8.1`
- WordPress REST context (register routes in `rest_api_init`)
- OpenSSL extension (required for `Rs256JwksJwtVerifier` since v0.6.0)
- Targets current WordPress 7.0 / WooCommerce 10.9; the optional Woo integration is tested against WooCommerce 10.9 stubs (WordPress stubs are capped at 6.9 by the WooCommerce stubs' dependency) and verified on a live WP 7.0 / WC 10.9 HPOS install

## Composer setup

As of v1.0.0 the package is published on [Packagist](https://packagist.org/packages/better-route/better-route) — install it directly, no repository entry needed:

```bash
composer require better-route/better-route:^1.1
```

Or in `composer.json`:

```json
{
  "require": {
    "better-route/better-route": "^1.1"
  }
}
```

If you need to track an unreleased branch (or a fork), add a VCS repository pointing at GitHub:

```json
{
  "require": {
    "better-route/better-route": "dev-main"
  },
  "repositories": [
    {
      "type": "vcs",
      "url": "https://github.com/Lonsdale201/better-route"
    }
  ]
}
```

## Local quality commands

```bash
composer test
composer analyse
composer cs-check
```

Composer scripts run tools through `php vendor/bin/...` so missing executable bits on shared mounts no longer break CI/local runs.

## Validation checklist

- `composer show better-route/better-route` resolves correctly
- `composer test` passes
- routes are registered only inside `rest_api_init`
