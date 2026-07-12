---
title: WooCommerce Overview
---

The WooCommerce integration layer provides a full CRUD REST surface for Orders, Products, Customers, and Coupons on top of the `better-route` router.

## Minimal example

```php
add_action('rest_api_init', function () {
    $router = \BetterRoute\BetterRoute::wooRouteRegistrar()
        ->register('myplugin/v1');
});
```

This registers all four resource groups under `/wp-json/myplugin/v1/woo/`.

## What you get

- Orders, Products, Customers, Coupons: list / get / create / update / delete
- Strict query contracts with unknown-param rejection
- Sparse field selection via `?fields=id,name,status`
- Pagination with `page` / `per_page` and `X-WP-Total` / `X-WP-TotalPages` headers
- Sortable lists with `?sort=-date_created` (prefix `-` for DESC)
- Optional HPOS guard on **order** routes: `503` if WooCommerce unavailable, `503` if HPOS required but disabled *(v1.0.0: was `409`; product / coupon / customer routes are not HPOS-gated)*
- Optional idempotency middleware on write endpoints (transient-, array-, or `wpdb`-backed)
- OpenAPI component schemas via `BetterRoute::wooOpenApiComponents()`
- *(v0.3.0)* configurable `deleteMode` (`'force'` or `'trash'`) for orders / products / coupons
- *(v0.3.0)* customer endpoints restricted to the `customer` role; create/update/delete gated by `create_users` / `edit_user` / `delete_user`
- *(v0.3.0)* protected meta keys (`_...`) hidden from output and rejected on write by default

## Architecture

Each resource has three layers:

1. **Service** (`WooOrderService`, `WooProductService`, etc.) — CRUD logic, field mapping
2. **QueryParser + Query DTO** — validates and normalizes list parameters
3. **WooRouteRegistrar** — wires services into the router with middleware

`WooRouteRegistrar` is the single entry point. Individual services are not meant to be instantiated directly in route definitions.

## Prerequisites

- WooCommerce 8.0+ (HPOS-capable)
- `better-route` installed via Composer

## Route map

| Resource   | List                | Get                    | Create              | Update                       | Delete                 |
|------------|---------------------|------------------------|---------------------|------------------------------|------------------------|
| Orders     | `GET /woo/orders`   | `GET /woo/orders/{id}` | `POST /woo/orders`  | `PUT\|PATCH /woo/orders/{id}` | `DELETE /woo/orders/{id}` |
| Products   | `GET /woo/products` | `GET /woo/products/{id}` | `POST /woo/products` | `PUT\|PATCH /woo/products/{id}` | `DELETE /woo/products/{id}` |
| Customers  | `GET /woo/customers`| `GET /woo/customers/{id}` | `POST /woo/customers` | `PUT\|PATCH /woo/customers/{id}` | `DELETE /woo/customers/{id}` |
| Coupons    | `GET /woo/coupons`  | `GET /woo/coupons/{id}` | `POST /woo/coupons` | `PUT\|PATCH /woo/coupons/{id}` | `DELETE /woo/coupons/{id}` |

The base path `/woo` is configurable via the `basePath` option.

## Validation checklist

- WooCommerce is active and functions like `wc_get_orders()` are available
- HPOS is enabled (if `requireHpos` is true)
- Unknown query parameters return `400`
- Requesting non-existent fields in `?fields=` does not cause errors (unknown fields are silently ignored)
