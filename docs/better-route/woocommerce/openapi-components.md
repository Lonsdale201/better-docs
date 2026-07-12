---
title: OpenAPI Components
---

The WooCommerce layer ships pre-built OpenAPI 3.1.0 component schemas that can be merged into your exported document.

## Minimal example

```php
$exporter = \BetterRoute\BetterRoute::openApiExporter();
$contracts = $router->contracts();

$document = $exporter->export($contracts, [
    'title'      => 'My Store API',
    'version'    => '1.0.0',
    'components' => \BetterRoute\BetterRoute::wooOpenApiComponents(),
]);
```

## Schemas provided

`BetterRoute::wooOpenApiComponents()` returns a `components` array containing:

**Shared**
- `MetaDataEntry` — `{id?, key, value}`

**Orders**
- `WooOrderAddress` — billing/shipping address fields
- `WooOrderLineItemInput` — line item write payload
- `WooOrderLineItem` — line item response
- `WooOrderInput` — order create/update payload
- `WooOrder` — full order response
- `WooOrderResponse` — `{data: WooOrder}`
- `WooOrderListResponse` — `{data: WooOrder[], meta: {page, perPage, total}}`

**Products**
- `WooProductInput` — product create/update payload
- `WooProduct` — full product response
- `WooProductResponse` / `WooProductListResponse`

**Customers**
- `WooCustomerAddress` — billing/shipping address fields
- `WooCustomerInput` — customer create/update payload
- `WooCustomer` — full customer response
- `WooCustomerResponse` / `WooCustomerListResponse`

**Coupons**
- `WooCouponInput` — coupon create/update payload
- `WooCoupon` — full coupon response
- `WooCouponResponse` / `WooCouponListResponse`

**Common**
- `DeleteResponse` — `{data: {id, deleted}}`

**Since 1.0.0:** monetary fields in these schemas are typed `string` (order `total` / `total_tax`, coupon `amount` / `minimum_amount` / `maximum_amount`, customer `total_spent`; line-item `total` / `subtotal` were already strings), matching how the API serializes money to avoid float drift.

## Security schemes

The `OpenApiExporter` supports declaring security schemes in the exported document:

```php
$document = $exporter->export($contracts, [
    'title'   => 'My Store API',
    'version' => '1.0.0',
    'securitySchemes' => [
        'bearerAuth' => [
            'type'         => 'http',
            'scheme'       => 'bearer',
            'bearerFormat' => 'JWT',
        ],
        'basicAuth' => [
            'type'   => 'http',
            'scheme' => 'basic',
        ],
        'apiKey' => [
            'type' => 'apiKey',
            'in'   => 'header',
            'name' => 'X-API-Key',
        ],
    ],
    'globalSecurity' => [
        ['bearerAuth' => []],
    ],
]);
```

Supported scheme types: Bearer (JWT), Basic, API Key, OAuth2, Cookie.

Per-route security can be set in route metadata via the `security` key, which overrides `globalSecurity` for that operation.

## Validation checklist

- Every `$ref` in the document resolves to a schema in `components`
- Custom components merged via `BetterRoute::wooOpenApiComponents()` do not collide with your own schema names
- Security scheme names used in route `security` metadata match keys in `securitySchemes`
