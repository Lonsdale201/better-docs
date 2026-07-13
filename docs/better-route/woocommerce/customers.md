---
title: Customers
---

The Customers resource provides full CRUD for WooCommerce customers (WordPress users with WC data).

## Endpoints

| Method         | Path                    | Description        |
|----------------|-------------------------|--------------------|
| GET            | `/woo/customers`        | List customers     |
| GET            | `/woo/customers/{id}`   | Get customer       |
| POST           | `/woo/customers`        | Create customer    |
| PUT / PATCH    | `/woo/customers/{id}`   | Update customer    |
| DELETE         | `/woo/customers/{id}`   | Delete customer    |

## List query parameters

| Parameter | Type           | Default              | Description                        |
|-----------|----------------|----------------------|------------------------------------|
| `fields`  | string         | default set          | Comma-separated field names        |
| `role`    | string\|array  | —                    | Filter by role (comma-separated)   |
| `email`   | string         | —                    | Exact email match                  |
| `search`  | string         | —                    | Wildcard search on display name    |
| `sort`    | string         | `-registered_date`   | Sort field, prefix `-` for DESC    |
| `page`    | int            | 1                    | Page number                        |
| `per_page`| int            | 20                   | Items per page (max 100)           |

Allowed sort fields: `registered_date`, `id`, `email`, `display_name`

## Available fields

**List defaults:** id, email, first_name, last_name, display_name, role, date_created

**All fields:** id, email, first_name, last_name, display_name, role, username, date_created, date_modified, billing, shipping, is_paying_customer, avatar_url, orders_count, total_spent, meta_data

**Since 1.0.0:** `orders_count` and `total_spent` are no longer in the list defaults — each is a per-customer order query, so including them by default made `list` an N+1. They are still returned by `get` and by `list` when requested explicitly via `?fields=`. `total_spent` is serialized as a decimal string; `orders_count` stays an integer.

## Create / Update payload

```json
{
  "email": "jane@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "username": "janedoe",
  "password": "securepassword123",
  "billing": {
    "first_name": "Jane",
    "last_name": "Doe",
    "address_1": "456 Oak Ave",
    "city": "Portland",
    "state": "OR",
    "postcode": "97201",
    "country": "US",
    "email": "jane@example.com",
    "phone": "+1234567890"
  },
  "shipping": { },
  "meta_data": [
    { "key": "preferred_language", "value": "en" }
  ]
}
```

## Notes

- `email` is required on create and must be unique. *(v1.1.0)* the create route's OpenAPI schema is `WooCustomerCreateInput`, which marks `email` as required.
- `username` is create-only. It cannot be changed after creation. *(v1.1.0)* sending `username` in an update payload returns `400 validation_failed`; previously it was silently ignored.
- `password` is write-only. It is never returned in responses.
- Address fields (billing/shipping): first_name, last_name, company, address_1, address_2, city, state, postcode, country, email, phone.
- Delete uses `wp_delete_user()` and permanently removes the WordPress user.

**Since 1.1.0:**

- The whole payload is validated before persistence: `email`, `first_name`, `last_name`, `username`, and `password` must be strings, unknown keys inside `billing`/`shipping` return `400 validation_failed` (`field not allowed`), and address values must be strings (no silent casting). The OpenAPI address schema declares `additionalProperties: false` to match.
- List sorting always appends an `ID` tie-breaker, so pagination is deterministic when many customers share the same sort value.

**Since 1.0.0:**

- `DELETE /customers/{id}` works in the REST context: the library loads `wp-admin/includes/user.php` before calling `wp_delete_user()` (that file is not auto-loaded on REST requests, so the endpoint previously failed silently). The `delete_user` capability check still applies.
- Invalid input rejected by a WooCommerce CRUD setter (e.g. an invalid email via `WC_Customer::set_email()`, a `WC_Data_Exception`) is returned as `400`, not `500`.

## v0.3.0 restrictions

- **Customer-only**: list/get/update/delete only work on users with the `customer` role. Non-customer users return `404` from `get` and are filtered out of `list`.
- **Capability checks** layered on top of the configured `permissions`:
  - `create` requires `create_users`
  - `update` requires `edit_user`
  - `delete` requires `delete_user`
- **Protected meta keys** (`_...`) are not returned and not writable by default.
