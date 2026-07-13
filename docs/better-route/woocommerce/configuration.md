---
title: Configuration
---

`WooRouteRegistrar::register()` accepts an options array that controls every aspect of the WooCommerce layer.

## Minimal example

```php
$router = \BetterRoute\BetterRoute::wooRouteRegistrar()
    ->register('myplugin/v1');
```

## Full options

```php
$router = \BetterRoute\BetterRoute::wooRouteRegistrar()
    ->register('myplugin/v1', [
        'basePath'       => '/woo',
        'requireHpos'    => true,
        'defaultPerPage' => 20,
        'maxPerPage'     => 100,
        'deleteMode'     => 'force', // v0.3.0; 'force' (default) or 'trash'
        'permissions'    => [
            'orders'    => 'manage_woocommerce',
            'products'  => 'manage_woocommerce',
            'customers' => 'manage_woocommerce',
            'coupons'   => 'manage_woocommerce',
        ],
        'actions' => [
            'orders'    => ['list', 'get', 'create', 'update', 'delete'],
            'products'  => ['list', 'get', 'create', 'update', 'delete'],
            'customers' => ['list', 'get'],
            'coupons'   => [], // v1.1.0: empty list disables the resource entirely
        ],
        'idempotency' => [
            'enabled'    => false,
            'requireKey' => false,
            'ttlSeconds' => 300,
            'store'      => null,
            'resources'  => [
                'orders'    => true,
                'products'  => true,
                'customers' => true,
                'coupons'   => true,
            ],
        ],
    ]);
```

## Option reference

**basePath** (string, default `'/woo'`)
URL prefix for all WooCommerce routes. Set to `/shop` to get `/wp-json/vendor/v1/shop/orders`.

**requireHpos** (bool, default `true`)
When true, the HPOS guard returns `503 hpos_required` if HPOS is not enabled. Set to `false` if you support legacy post-based orders.

**Since 1.0.0:** `requireHpos` gates only the **order** routes. Product, coupon, and customer routes are not moved by HPOS, so they only require WooCommerce to be available and never return `hpos_required`. The HPOS-unavailable status is now `503` (was `409`).

**defaultPerPage** (int, default `20`)
Default number of items returned by list endpoints when `per_page` is not specified.

**maxPerPage** (int, default `100`)
Upper cap for `per_page`. Values above this are silently clamped.

**permissions** (array)
Per-resource capability string. The capability is checked via `current_user_can()` before every handler.

**actions** (array)
Per-resource list of enabled actions. Omit an action to disable its route entirely. Valid values: `list`, `get`, `create`, `update`, `delete`.

**Since 1.1.0:** an explicit empty list (`'coupons' => []`) disables the resource entirely — no coupon routes are registered. (Before 1.1.0 an empty list silently fell back to the full action set.) Unknown action names and non-array values are now rejected with an `InvalidArgumentException` at registration time instead of being silently ignored.

**idempotency** (array)
Controls the idempotency middleware on POST/PUT/PATCH routes. **Since 1.1.0** this is the [`AtomicIdempotencyMiddleware`](../write-safety/atomic-idempotency) (reservation-based, safe for side-effectful writes), and it is attached to **all four** resources' create/update routes — before 1.1.0 the `customers` / `coupons` toggles existed but no middleware was wired to those routes.

- `enabled`: master switch (default `false`)
- `requireKey`: if true, POST/PUT/PATCH without `Idempotency-Key` header returns `400` (default `false`)
- `ttlSeconds`: how long a reservation/response is kept (default `300`)
- `store`: an `AtomicIdempotencyStoreInterface` instance *(v1.1.0; was `IdempotencyStoreInterface`)*. See the default-store note below.
- `resources`: per-resource toggle — set to `false` to disable idempotency for a specific resource

**Default idempotency store *(v1.1.0)*:** when `store` is omitted and `$wpdb` is available, the registrar uses the lease-aware `WpdbAtomicIdempotencyStore` and installs/migrates its table via `installSchema()`. A versioned option (`better_route_atomic_idempotency_schema_version`) prevents repeated DDL/schema checks once install succeeded; a schema/install failure is reported as an error instead of silently degrading to a request-local store. `ArrayAtomicIdempotencyStore` (request-local, for tests/non-WP runtimes) is used only when no `$wpdb` exists. When idempotency is enabled, the write routes' OpenAPI meta automatically documents the `Idempotency-Key` header parameter (marked required when `requireKey` is true).

**deleteMode** (string, default `'force'`) *(v0.3.0)*
Applies to orders, products, and coupons. `'force'` permanently deletes the entity; `'trash'` moves it to the trash so it can be restored.

## v0.3.0 security defaults

- **Customer endpoints are restricted to users with the `customer` role.** Lookups for non-customer users return `404`.
- **Customer create/update/delete require WordPress user-management capabilities** (`create_users` / `edit_user` / `delete_user`) in addition to the configured `permissions` capability.
- **Protected meta keys (starting with `_`) are not returned and not writable** by default. Pass `$allowProtected = true` at the call site only when intentional.

## Declaring HPOS compatibility (host plugin) *(v1.0.0)*

A library cannot declare HPOS (custom order tables) compatibility on behalf of the plugin that embeds it. Any plugin that exposes these order routes touches orders and must declare compatibility on `before_woocommerce_init`, or WooCommerce flags it incompatible and blocks HPOS enablement. Call the helper from your plugin's main file:

```php
\BetterRoute\Integration\Woo\HposGuard::declareCompatibility(__FILE__);
```

This registers a `before_woocommerce_init` callback that calls `FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true)`. The runtime `requireHpos` guard does not remove this obligation.

## Read-only store example

```php
$router = \BetterRoute\BetterRoute::wooRouteRegistrar()
    ->register('myplugin/v1', [
        'actions' => [
            'orders'   => ['list', 'get'],
            'products' => ['list', 'get'],
        ],
    ]);
```

This exposes only GET endpoints. No create/update/delete routes are registered.

## Common mistakes

- Setting `basePath` to an empty string — it defaults back to `/woo`
- Enabling `requireHpos` on a site without WooCommerce — the guard returns `503` before any handler runs
- Forgetting that `maxPerPage` must be >= `defaultPerPage`
