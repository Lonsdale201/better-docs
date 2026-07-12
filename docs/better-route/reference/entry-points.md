---
title: Entry Points
---

## BetterRoute facade

### `BetterRoute::router(string $vendor, string $version): Router`

Usage:

```php
use BetterRoute\BetterRoute;

$router = BetterRoute::router('better-route', 'v1');
```

### `BetterRoute::openApiExporter(): OpenApiExporter`

Usage:

```php
$exporter = BetterRoute::openApiExporter();
$document = $exporter->export($contracts, ['version' => 'v1.0.0']);
```

### `BetterRoute::wooRouteRegistrar(): WooRouteRegistrar`

Usage:

```php
$router = BetterRoute::wooRouteRegistrar()
    ->register('myapp/v1');
```

### `BetterRoute::wooOpenApiComponents(): array`

Returns pre-built OpenAPI component schemas for all WooCommerce resources.

```php
$components = BetterRoute::wooOpenApiComponents();
```

## WooCommerce HPOS compatibility *(v1.0.0)*

### `HposGuard::declareCompatibility(string $pluginFile): void`

A host plugin that embeds the WooCommerce order routes must declare `custom_order_tables` (HPOS) compatibility on `before_woocommerce_init`. Call this from the host plugin's main file — the library cannot declare on the host's behalf:

```php
use BetterRoute\Integration\Woo\HposGuard;

HposGuard::declareCompatibility(__FILE__);
```

## Version marker

The latest released Composer tag is `v1.0.0`.

`BetterRoute\Support\Version::VERSION` is the in-source marker; treat the Composer tag as the source of truth and align documentation against `v1.0.0` behavior.
