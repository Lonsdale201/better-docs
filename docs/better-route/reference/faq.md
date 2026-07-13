---
title: FAQ
---

## Is this a full WordPress plugin with admin UI?

No. It is a Composer library for API contract and middleware composition.

## Is WooCommerce supported with dedicated abstractions?

Yes, since `v0.2.0`. The WooCommerce integration layer provides full CRUD for Orders, Products, Customers, and Coupons with query parsing, HPOS guard, and pre-built OpenAPI schemas. See the WooCommerce section for details.

## Is package registry publishing available now?

Yes. Since v1.0.0 the library is published on [Packagist](https://packagist.org/packages/better-route/better-route):

```bash
composer require better-route/better-route:^1.1
```

## Does middleware auth replace `permission_callback`?

No. Permission callback is still explicit during route registration.

## Can I hide routes from OpenAPI export?

Yes. Set meta:

```php
->meta(['openapi' => ['include' => false]])
```

## Are unknown query params ignored?

No. Resource list parsers reject unknown params with `400 validation_failed`.
