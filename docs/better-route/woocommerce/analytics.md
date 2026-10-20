---
title: Analytics Reports
---

Better Route 1.1.2 provides an opt-in read-only Analytics service. WooRouteRegistrar does
not add report routes automatically. Register only the reports the application needs.

```php
use BetterRoute\Integration\Woo\WooAnalyticsService;
use BetterRoute\Integration\Woo\WooAnalyticsOpenApi;
use BetterRoute\Router\Router;

add_action('rest_api_init', static function (): void {
    $service = new WooAnalyticsService();
    $report = 'orders/stats';
    $router = Router::make('myapp', 'v1');
    $router->get('/analytics/orders/stats', static fn ($request): array => $service->report($report, $request))
        ->args(WooAnalyticsOpenApi::args($report))
        ->meta(WooAnalyticsOpenApi::meta($report))
        ->permission(static fn (): bool => current_user_can('view_woocommerce_reports'));
    $router->register();
});
```

The example expects native WordPress authentication, such as Application Passwords over
HTTPS. For JWT/Bearer, configure issuer-safe native WP user mapping and actual authorization;
a token claim or permissive route callback alone does not establish the native user.

## Supported reports and queries

Reports: revenue/stats, orders/stats, products, products/stats, categories, customers,
customers/stats, coupons, coupons/stats, taxes, stock and variations. The allowlist is fixed;
the service is not an arbitrary native REST proxy.

| Parameter | Contract |
|---|---|
| after / before | Datetimes with optional offsets; omitted offset uses shop timezone; default last seven days |
| compare_after / compare_before | Both required together; independently validated comparison window |
| page / per_page | Paginated reports: page 1–10000, per_page 1–100; defaults 1/20 |
| orderby / order | Report-specific orderby allowlist; asc/desc, stock defaults asc and other reports desc |
| interval | Where supported: hour/day/week/month/quarter/year; default day |
| segmentby | Only each report's declared segment allowlist |

Windows must be ordered and at most 366 days; hourly windows at most 31 days. Stock accepts
no dates/comparison. Customers/stats has no pagination or interval. Use the helper args or
AnalyticsReports::definition() for exact report-specific availability.

Unknown parameters return 400, including `_locale`, `_fields` and `context`. Unlike CRUD,
Analytics does not accept WordPress global query arguments; configure frontend clients
such as wp.apiFetch accordingly.

## Permissions and readiness

The service mandates the current native WP user's view_woocommerce_reports and preserves
upstream report permissions. Stock can require additional native capabilities. It performs
internal native REST dispatch without loopback HTTP, user elevation or a wrapper response cache.

Disabled/unavailable Analytics returns analytics_unavailable 503. Unknown, running,
incomplete or insufficient historical import coverage returns analytics_data_not_ready
503, checking both primary and comparison windows. Stock has no import-readiness gate.
The wrapper starts no imports. Configure imports operationally; idle means import state,
not guaranteed realtime freshness.

## Response and OpenAPI

The response is `{report,data,meta,comparison?}` without another data envelope. Stats contain
totals/intervals, collections contain items, and meta.totalUnit distinguishes intervals/items.
Customers/stats only includes readiness metadata. Comparison contains a nonrecursive result.

Money is a decimal string, counts are integers and averages can be fractional. The mapper
strips unknown extension fields and links. Empty metric maps serialize as objects.

Merge BetterRoute::wooOpenApiComponents() into export options and enable strictSchemas.
The helper supplies report parameters and schemas, not authentication definitions: configure
the application's real security schemes/global or per-route requirements separately.
Override the helper operation ID if exposing one report more than once.

## Tested scope

CI uses WP 6.9.4/Woo 10.9.4, PHP 8.1/8.3 and HPOS/CPT. Synthetic native lookup data covers
all twelve reports, reports-only users, comparison, readiness, projection and identity
preservation; external JSON Schema validation checks actual responses. Readiness providers
are request-local fixtures. This does not establish a complete background import, an
external identity-provider deployment or every WP/Woo version combination.
