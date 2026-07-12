---
title: Installation
---

## Runtime requirements

- PHP `^8.1`
- WordPress REST context (register routes in `rest_api_init`)
- OpenSSL extension (required for `Rs256JwksJwtVerifier` since v0.6.0)
- Targets current WordPress 7.0 / WooCommerce 10.9; the optional Woo integration is tested against WooCommerce 10.9 stubs (WordPress stubs are capped at 6.9 by the WooCommerce stubs' dependency) and verified on a live WP 7.0 / WC 10.9 HPOS install

## Composer setup

Use VCS repository setup from the public GitHub repository:

```json
{
  "require": {
    "better-route/better-route": "^1.0"
  },
  "repositories": [
    {
      "type": "vcs",
      "url": "https://github.com/Lonsdale201/better-route"
    }
  ],
  "prefer-stable": true
}
```

After package index publication, you can remove the `repositories` block and keep only `require`.

```json
{
  "require": {
    "better-route/better-route": "^1.0"
  }
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
- no docs assumptions rely on unpublished package index features
