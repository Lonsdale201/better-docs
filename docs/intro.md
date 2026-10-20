---
title: Better Docs
sidebar_position: 1
---

Documentation for two complementary WordPress PHP libraries:

## better-route

Composer-first REST contract layer for teams that need stable, versioned APIs. Fluent router on top of `register_rest_route()`, middleware pipeline, Resource DSL for CPTs and custom tables, OpenAPI 3.1 export, and a full WooCommerce integration (Orders / Products / Customers / Coupons).

- Latest release: **v2.0.0** (PHP 8.3+); **v1.1.3** security maintenance for PHP 8.1/8.2
- Source: [github.com/Lonsdale201/better-route](https://github.com/Lonsdale201/better-route)
- Start here: [better-route Documentation](better-route/intro)

## better-data

PHP 8.3+ DTO and Presenter library for WordPress. Typed, immutable DTOs hydrated from posts / users / terms / options / `$wpdb` rows / REST requests; symmetric write sinks; contextual output shaping (REST / admin / email / CSV); attribute-driven validation; and security primitives (`Secret`, `#[Sensitive]`, AES-256-GCM `#[Encrypted]`).

- Latest release: **v1.0.0**
- Source: [github.com/Lonsdale201/better-data](https://github.com/Lonsdale201/better-data)
- Start here: [better-data Documentation](better-data/intro)

## Use them together

`better-data`'s `BetterRouteBridge` wires DTOs into a `better-route` `Router`. The DTO drives hydration, validation, REST args, OpenAPI schemas, and response shaping; the router handles routing, middleware, permissions, and OpenAPI export. Either library works alone; the bridge is opt-in.

- See: [Composition](composition/overview)

## Picking a starting point

| You want to... | Go to |
|---|---|
| Expose a REST API with strict contracts | [better-route](better-route/intro) |
| Define typed data with WP-aware hydration | [better-data](better-data/intro) |
| Do both — DTOs driving REST endpoints | [Composition](composition/overview) |
| See AI agent skills | [better-route AI skills](better-route/agents) · [better-data AI skills](better-data/agents) |
