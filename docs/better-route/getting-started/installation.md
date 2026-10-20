---
title: Installation
---

## Runtime requirements

- PHP `^8.3` in web, CLI, cron and worker processes
- WordPress REST context (register routes in `rest_api_init`)
- OpenSSL extension (required for `Rs256JwksJwtVerifier` since v0.6.0)
- Better Route 2.0 CI tests PHP 8.3–8.5 and runs WordPress 6.9.4 / WooCommerce 10.9.4 on PHP 8.3/8.5 in HPOS/CPT modes. Static-analysis stubs and this measured runtime matrix do not establish every version combination.

Read [Upgrade to 2.0](migration) before updating an existing installation. Older
PHP 8.1/8.2 consumers should install the [1.1.3 security patch](../release-notes/v1.1.3)
with `composer require better-route/better-route:^1.1.3`. On 1.1.2 or older, use an
explicit URL-bound Resource ownership policy until that fix is installed.

## Composer setup

As of v1.0.0 the package is published on [Packagist](https://packagist.org/packages/better-route/better-route) — install it directly, no repository entry needed:

```bash
composer require better-route/better-route:^2.0
composer check-platform-reqs --no-dev
```

Or in `composer.json`:

```json
{
  "require": {
    "better-route/better-route": "^2.0"
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
