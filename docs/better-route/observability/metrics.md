---
title: Metrics
---

`MetricsMiddleware` emits request counters and latency observations.

## Minimal example

```php
use BetterRoute\Middleware\Observability\MetricsMiddleware;
use BetterRoute\Observability\PrometheusMetricSink;

$metrics = new MetricsMiddleware(
    metrics: new PrometheusMetricSink(),
    metricPrefix: 'better_route_'
);
```

## Emitted metrics

- `${prefix}requests_total`
- `${prefix}request_duration_seconds`
- `${prefix}errors_total` (only on 4xx/5xx or thrown exceptions)

Default labels:

- `route`
- `method`
- `status_class` (`2xx`, `4xx`, `5xx`, ...)

Error metric adds:

- `error_code`

## Prometheus rendering

`PrometheusMetricSink::render()` outputs counter and summary lines ready for scrape/export.

`PrometheusMetricSink` and `InMemoryMetricSink` are **process/request-local** collectors — counters reset with each PHP request. Export the rendered output per request, or replace the sink with one backed by persistent storage when you need cross-request totals.

## v1.1.0 behavior changes

- **Telemetry failures never mask application results.** A sink that throws inside `increment()`/`observe()` is swallowed; the response (or the in-flight application exception) is returned unchanged.
- **`metricPrefix` is validated** at construction against the Prometheus metric-name grammar (`[a-zA-Z_:][a-zA-Z0-9_:]*`); an invalid prefix throws `InvalidArgumentException` instead of producing an unscrapable exposition.
- **`PrometheusMetricSink` validates metric names and label names** on write and rejects negative counter increments, so a bad caller cannot corrupt the rendered exposition format.

## Common mistakes

- Missing error-code extraction from structured responses
- Inconsistent metric prefix across apps
- Using route templates that explode label cardinality

## Validation checklist

- successful + failed calls increment `requests_total`
- failures increment `errors_total`
- duration observations are emitted for all outcomes
