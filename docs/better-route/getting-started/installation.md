---
title: Installation
---

## Runtime requirements

- PHP `^8.1`
- WordPress REST context (register routes in `rest_api_init`)
- OpenSSL extension (required for `Rs256JwksJwtVerifier` since v0.6.0)
- Better Route 1.1.1 was runtime-verified with WordPress 7.1.1 / WooCommerce 11.1.1 / PHP 8.3, including HPOS and legacy order storage. Static analysis uses WooCommerce 10.9 stubs (which cap WordPress stubs at 6.9); stub versions are not the runtime compatibility matrix.

Read [Upgrade to 1.1.1](migration) before updating an existing installation, especially one with idempotent writes.

## Composer setup

As of v1.0.0 the package is published on [Packagist](https://packagist.org/packages/better-route/better-route) — install it directly, no repository entry needed:

```bash
composer require better-route/better-route:^1.1.1
```

Or in `composer.json`:

```json
{
  "require": {
    "better-route/better-route": "^1.1.1"
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
