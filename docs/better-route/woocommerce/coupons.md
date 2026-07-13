---
title: Coupons
---

The Coupons resource provides full CRUD for WooCommerce discount coupons.

## Endpoints

| Method         | Path                  | Description      |
|----------------|-----------------------|------------------|
| GET            | `/woo/coupons`        | List coupons     |
| GET            | `/woo/coupons/{id}`   | Get coupon       |
| POST           | `/woo/coupons`        | Create coupon    |
| PUT / PATCH    | `/woo/coupons/{id}`   | Update coupon    |
| DELETE         | `/woo/coupons/{id}`   | Delete coupon    |

## List query parameters

| Parameter | Type   | Default           | Description                     |
|-----------|--------|-------------------|---------------------------------|
| `fields`  | string | default set       | Comma-separated field names     |
| `code`    | string | —                 | Exact coupon code match         |
| `search`  | string | —                 | General text search             |
| `sort`    | string | `-date_created`   | Sort field, prefix `-` for DESC |
| `page`    | int    | 1                 | Page number                     |
| `per_page`| int    | 20                | Items per page (max 100)        |

Allowed sort fields: `date_created`, `date_modified`, `id`, `code`

## Available fields

**List defaults:** id, code, amount, discount_type, date_created, date_expires, usage_count, usage_limit

**All fields:** id, code, amount, discount_type, description, date_created, date_modified, date_expires, usage_count, usage_limit, usage_limit_per_user, limit_usage_to_x_items, individual_use, product_ids, excluded_product_ids, free_shipping, minimum_amount, maximum_amount, email_restrictions, exclude_sale_items, meta_data

## Create / Update payload

```json
{
  "code": "SUMMER25",
  "amount": "25.00",
  "discount_type": "percent",
  "description": "Summer sale 25% off",
  "date_expires": "2025-09-01T00:00:00",
  "usage_limit": 500,
  "usage_limit_per_user": 1,
  "individual_use": true,
  "minimum_amount": "50.00",
  "maximum_amount": "500.00",
  "free_shipping": false,
  "exclude_sale_items": true,
  "product_ids": [42, 55],
  "excluded_product_ids": [99],
  "email_restrictions": ["vip@example.com"],
  "meta_data": [
    { "key": "campaign", "value": "summer-2025" }
  ]
}
```

## Notes

- `code` is required on create and must be a non-empty string. *(v1.1.0)* the create route's OpenAPI schema is `WooCouponCreateInput`, which marks `code` as required.
- `discount_type` accepts: `percent`, `fixed_cart`, `fixed_product`.
- `product_ids` and `excluded_product_ids` are arrays of integers.
- `email_restrictions` is an array of email address strings.
- `date_expires` accepts an ISO date string or `null`.

**Since 1.1.0:**

- The uniqueness check now also applies to **updates**: changing a coupon's `code` to one that another coupon already uses is rejected with `409 coupon_exists` (the coupon's own id is excluded, so re-saving the same code is fine).
- Writes that set `code` are serialized under a per-code MySQL advisory lock, so two concurrent requests cannot both pass the uniqueness check and create duplicates. If the lock cannot be acquired within 2 seconds, the request fails with `409 coupon_write_in_progress`.
- The whole payload is validated before persistence: string fields must be strings, `amount` / `minimum_amount` / `maximum_amount` must be non-negative numbers, `usage_limit` / `usage_limit_per_user` / `limit_usage_to_x_items` must be non-negative integers, boolean fields reject unrecognized values, and `product_ids` / `excluded_product_ids` / `email_restrictions` are type-checked — all with `400 validation_failed`.
- List sorting always appends an `ID` tie-breaker, so pagination is deterministic when many coupons share the same sort value.

**Since 1.0.0:**

- The `code` filter and coupon creation resolve through `wc_get_coupon_id_by_code()`, applying WooCommerce's coupon-code normalization and cache instead of a raw title match.
- Creating a coupon whose `code` already exists is rejected with `409 coupon_exists` (duplicate codes make `WC_Coupon( code )` resolution ambiguous at apply time).
- Monetary fields (`amount`, `minimum_amount`, `maximum_amount`) are serialized as decimal strings in responses.
- Invalid input rejected by a WooCommerce CRUD setter (e.g. an invalid `discount_type`, a `WC_Data_Exception`) is returned as `400`, not `500`.

## v0.3.0 changes

- `deleteMode` (`'force'` default or `'trash'`) on the registrar controls whether `DELETE` permanently removes or trashes the coupon.
- Protected meta keys (`_...`) are not returned and not writable by default.
