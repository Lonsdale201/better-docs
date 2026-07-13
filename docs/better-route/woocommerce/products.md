---
title: Products
---

The Products resource provides full CRUD for WooCommerce products.

## Endpoints

| Method         | Path                  | Description      |
|----------------|-----------------------|------------------|
| GET            | `/woo/products`       | List products    |
| GET            | `/woo/products/{id}`  | Get product      |
| POST           | `/woo/products`       | Create product   |
| PUT / PATCH    | `/woo/products/{id}`  | Update product   |
| DELETE         | `/woo/products/{id}`  | Delete product   |

## List query parameters

| Parameter      | Type           | Default           | Description                         |
|----------------|----------------|-------------------|-------------------------------------|
| `fields`       | string         | default set       | Comma-separated field names         |
| `status`       | string\|array  | —                 | Filter by status (comma-separated)  |
| `type`         | string         | —                 | Filter by product type              |
| `sku`          | string         | —                 | Exact SKU match                     |
| `search`       | string         | —                 | Text search                         |
| `stock_status` | string         | —                 | instock, outofstock, onbackorder    |
| `sort`         | string         | `-date_created`   | Sort field, prefix `-` for DESC     |
| `page`         | int            | 1                 | Page number                         |
| `per_page`     | int            | 20                | Items per page (max 100)            |

Allowed sort fields: `date_created`, `date_modified`, `id`, `title`

## Available fields

**List defaults:** id, name, slug, status, type, sku, price, stock_status, date_created, date_modified

**All fields:** id, name, slug, status, type, sku, price, regular_price, sale_price, date_created, date_modified, catalog_visibility, description, short_description, stock_status, stock_quantity, manage_stock, virtual, downloadable, meta_data

**Since 1.0.0:** `price` is **read-only** — it is a derived field that WooCommerce computes from `regular_price`/`sale_price` (and the scheduled-sale sync). It is still returned in responses, but sending it in a create/update payload is rejected with `400 validation_failed`; set `regular_price`/`sale_price` instead. Monetary fields are serialized as decimal strings (e.g. `"29.99"`).

## Create / Update payload

```json
{
  "name": "Premium Widget",
  "status": "publish",
  "type": "simple",
  "sku": "WDG-001",
  "regular_price": "29.99",
  "sale_price": "24.99",
  "description": "Full product description.",
  "short_description": "A premium widget.",
  "stock_status": "instock",
  "stock_quantity": 50,
  "manage_stock": true,
  "virtual": false,
  "downloadable": false,
  "catalog_visibility": "visible",
  "meta_data": [
    { "key": "brand", "value": "WidgetCo" }
  ]
}
```

## Notes

- `type` is create-only. It cannot be changed after creation. Defaults to `simple` when omitted.
- Boolean fields (`manage_stock`, `virtual`, `downloadable`) accept booleans, integers (0/1), or strings (`"true"`, `"false"`, `"yes"`, `"no"`).
- `stock_quantity` accepts an integer or `null`.

**Since 1.1.0:**

- The whole payload is validated before persistence: string fields must be strings, `regular_price`/`sale_price` must be empty or a non-negative number, `stock_quantity` must be an integer or `null` (non-integer numerics are rejected instead of being truncated), and boolean fields reject values outside the accepted forms — all with `400 validation_failed`.
- List sorting always appends an `ID` tie-breaker, so pagination is deterministic when many products share the same sort value.
- The `WooProductInput` OpenAPI schema no longer advertises the read-only `price` field, matching runtime behavior.

**Since 1.0.0:**

- The `search` parameter maps to the supported `s` query var. (Earlier versions passed an unsupported `search` var that WooCommerce silently ignored, returning unfiltered results.)
- `sort=price` was removed — WooCommerce's product query does not reliably order by price, so it is no longer advertised and returns `400 validation_failed`.
- Invalid input rejected by a WooCommerce CRUD setter (`WC_Data_Exception`) is returned as `400`, not `500`.

## v0.3.0 changes

- `deleteMode` (`'force'` default or `'trash'`) on the registrar controls whether `DELETE` permanently removes or trashes the product.
- Protected meta keys (`_...`) are not returned and not writable by default.
