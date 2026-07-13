---
title: Router API Reference
---

## `Router::make($vendor, $version)`

Creates router instance with namespace `<vendor>/<version>`.

## `middleware(array $middlewares)`

Adds middleware globally, or to current group scope when called inside `group()`.

## `middlewareFactory(callable $factory)`

Resolves class-string middleware with dependencies.

Factory signature:

```php
callable(string $class): mixed
```

## `group(string $prefix, callable $callback)`

Nests routes and middlewares under prefix.

## HTTP method mapping

- `get($uri, $handler)`
- `post($uri, $handler)`
- `put($uri, $handler)`
- `patch($uri, $handler)`
- `delete($uri, $handler)`
- `options($uri, $handler)` *(v0.5.0)* — explicit `OPTIONS` routes. Since v1.1.0 they deny by default like every other method (declare intent explicitly); CORS preflight is normally answered by the [WordPress CORS bridge](../public-client/cors) before dispatch, so an explicit `OPTIONS` route is no longer required for CORS.

Returns `RouteBuilder` for chain methods.

## `routes()`

Returns internal `RouteDefinition` list.

## `baseNamespace()`

Returns final namespace string.

## `contracts(bool $openApiOnly = false)`

Returns contract list for OpenAPI/export.

## `register(?DispatcherInterface $dispatcher = null)`

Registers all routes through dispatcher (`WordPressRestDispatcher` by default). *(v1.1.0)* The default dispatcher throws a `RuntimeException` when invoked outside `rest_api_init` or when WordPress core rejects a route; middleware implementing `WordPressRouteMiddlewareInterface` (e.g. `CorsMiddleware`) is announced each matched route at this point.

## `RouteBuilder` methods

- `middleware(array $middlewares)`
- `meta(array $meta)`
- `args(array $args)`
- `permission(callable $permissionCallback)`
- `protectedByMiddleware(string|array|null $security = null)` *(v0.4.0)* — sets a permission callback that defers authorization to the better-route middleware pipeline (e.g. `JwtAuthMiddleware`). Optional argument is propagated to OpenAPI as the operation-level `security` (string scheme name or `[['scheme' => [...scopes]]]` array).
- `publicRoute()` *(v0.4.0)* — marks the route as intentionally public and clears OpenAPI `security` for the operation (overrides any `globalSecurity`).

Since v0.4.0, raw `Router` write methods (`POST`/`PUT`/`PATCH`/`DELETE`) without an explicit permission callback deny by default. **Since v1.1.0 this applies to every method — `GET` and `OPTIONS` included.** Pick `permission()`, `protectedByMiddleware()`, or `publicRoute()` to make intent explicit on every route.

Example:

```php
$router->get('/items/(?P<id>\d+)', $handler)
    ->args(['id' => ['required' => true, 'type' => 'integer']])
    ->meta(['operationId' => 'itemsGet'])
    ->permission(static fn (): bool => current_user_can('read'));

$router->post('/secure/articles', $handler)
    ->protectedByMiddleware('bearerAuth');

$router->post('/webhooks/intake', $handler)
    ->publicRoute();
```
