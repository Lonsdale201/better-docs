---
title: Orders
---

The Orders resource provides full CRUD for WooCommerce orders with HPOS support.

## Endpoints

| Method         | Path                | Description    |
|----------------|---------------------|----------------|
| GET            | `/woo/orders`       | List orders    |
| GET            | `/woo/orders/{id}`  | Get order      |
| POST           | `/woo/orders`       | Create order   |
| PUT / PATCH    | `/woo/orders/{id}`  | Update order   |
| DELETE         | `/woo/orders/{id}`  | Delete order   |

## List query parameters

| Parameter     | Type           | Default           | Description                         |
|---------------|----------------|-------------------|-------------------------------------|
| `fields`      | string         | default set       | Comma-separated field names         |
| `status`      | string\|array  | —                 | Filter by status (comma-separated)  |
| `customer_id` | int            | —                 | Filter by customer ID               |
| `search`      | string         | —                 | Full-text order search              |
| `sort`        | string         | `-date_created`   | Sort field, prefix `-` for DESC     |
| `page`        | int            | 1                 | Page number                         |
| `per_page`    | int            | 20                | Items per page (max 100)            |

Allowed sort fields: `date_created`, `date_modified`, `id`, `total`

## Available fields

**List defaults:** id, number, status, currency, total, customer_id, date_created, date_modified

**All fields:** id, number, status, currency, total, total_tax, customer_id, billing_email, payment_method, payment_method_title, date_created, date_modified, billing, shipping, customer_note, meta_data, line_items

## Create / Update payload

```json
{
  "status": "processing",
  "customer_id": 12,
  "currency": "USD",
  "payment_method": "bacs",
  "payment_method_title": "Direct Bank Transfer",
  "billing": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address_1": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "postcode": "62701",
    "country": "US"
  },
  "shipping": { },
  "customer_note": "Leave at door",
  "set_paid": true,
  "line_items": [
    {
      "product_id": 42,
      "quantity": 2
    }
  ],
  "meta_data": [
    { "key": "source", "value": "mobile-app" }
  ]
}
```

## Line items

Each line item accepts: `product_id` (required), `variation_id`, `quantity`, `subtotal`, `total`, `meta_data`.

**Since 1.1.0:** line items are validated before anything is persisted — unknown keys return `400 validation_failed` (`field not allowed`), `product_id` must reference an existing product, `quantity` must be a positive integer, and `subtotal`/`total` must be non-negative numbers.

**Since 1.0.0:** when a line item supplies a `variation_id`, the order is built from the actual variation product (validated to belong to the given `product_id`), so its price, name, and attributes come from the variation — not the parent product. A `variation_id` that does not belong to `product_id` is rejected with `400 validation_failed`.

On update, providing `line_items` replaces all existing items and totals are recalculated automatically.

**Since 1.0.0:** replacing line items on an order that has already reduced stock is rejected with `409 woo_line_items_locked`, because removing and re-adding items would silently corrupt inventory. Edit line items before stock reduction, or adjust a stock-reduced order through status transitions.

## Money and validation

**Since 1.1.0:**

- The whole payload is validated **before** persistence: scalar fields (`status`, `currency`, `payment_method`, `payment_method_title`, `customer_note`) must be strings, `set_paid` must be a boolean, and a non-zero `customer_id` must reference an existing user — violations return `400 validation_failed` without touching the order.
- Create and update run inside a WooCommerce transaction (`wc_transaction_query`): if any part of the write fails, the whole order write is rolled back instead of persisting a half-built order.
- List sorting always appends an `ID` tie-breaker, so pagination is deterministic when many orders share the same sort value (e.g. `total`).

**Since 1.0.0:**

- Monetary fields — order `total`, `total_tax`, and line-item `subtotal`/`total` — are serialized as decimal **strings** (e.g. `"45.40"`), matching WooCommerce's own REST API and avoiding float rounding drift.
- The `search` parameter maps to the supported `s` query var. (Earlier versions passed an unsupported `search`/`*term*` var that WooCommerce silently ignored, returning unfiltered results.)
- Invalid input rejected by a WooCommerce CRUD setter (`WC_Data_Exception`) is returned as `400`, not `500`.

## set_paid

When `set_paid` is `true`, `payment_complete()` is called after save. This triggers WooCommerce stock reduction and status transitions.

## Address fields

Both `billing` and `shipping` accept: first_name, last_name, company, address_1, address_2, city, state, postcode, country, email, phone.

**Since 1.1.0:** unknown keys inside `billing`/`shipping` are rejected with `400 validation_failed` (`field not allowed`), and every address value must be a string (values are no longer silently cast). The OpenAPI address schemas declare `additionalProperties: false` to match.

## Delete mode (v0.3.0)

Configurable via `deleteMode` on the registrar:

- `'force'` (default) — permanently deletes the order via `wp_delete_post(..., true)`
- `'trash'` — sends the order to the trash so it can be restored from WP admin

## Protected meta keys (v0.3.0)

Meta keys starting with `_` (e.g., `_order_total`, `_payment_method_title`) are not returned in responses and are rejected on write by default.
