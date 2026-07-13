---
title: Router
---

`BetterRoute\Router\Router` is the contract-first route builder.

## When to use

- You need fully custom handlers (not CRUD resource presets)
- You want per-route meta for OpenAPI
- You need middleware at global/group/route scope

## Minimal example

```php
use BetterRoute\Router\Router;

add_action('rest_api_init', function (): void {
    $router = Router::make('better-route', 'v1')
        ->middleware([
            static function ($ctx, callable $next): mixed {
                return $next($ctx);
            },
        ]);

    $router->group('/admin', function (Router $r): void {
        $r->get('/health', fn (): array => ['ok' => true])
            ->meta(['operationId' => 'adminHealth', 'tags' => ['Admin']])
            ->permission(static fn (): bool => current_user_can('manage_options'));
    });

    $router->register();
});
```

## Public API

- `Router::make(string $vendor, string $version): Router`
- `middleware(array $middlewares): self`
- `middlewareFactory(callable $factory): self`
- `group(string $prefix, callable $callback): self`
- `get/post/put/patch/delete/options(string $uri, mixed $handler): RouteBuilder`
- `routes(): array`
- `baseNamespace(): string`
- `contracts(bool $openApiOnly = false): array`
- `register(?DispatcherInterface $dispatcher = null): void`

## Handler signatures

`ArgumentResolver` supports:

- `fn (): mixed`
- `fn (RequestContext $ctx): mixed`
- `fn ($request): mixed`
- `fn (RequestContext $ctx, $request): mixed`
- `[ControllerClass::class, 'method']` (instantiated internally)

## Route intent (v0.4.0, extended in v1.1.0)

**Every** route registered on the raw `Router` without an explicit `permission()` callback is **deny-by-default** at the WordPress permission layer — since v1.1.0 this includes `GET` and `OPTIONS`, not just write methods. An omitted permission is treated as a configuration error: routes fail with `403` until you make intent explicit:

- `->permission(callable)` — supply a WP permission callback (e.g. capability checks).
- `->protectedByMiddleware(string|array|null $security = null)` — let the request reach the better-route middleware pipeline so an auth middleware (`JwtAuthMiddleware`, `BearerTokenAuthMiddleware`, etc.) can authenticate or short-circuit. Optional argument sets the OpenAPI `security` for the operation.
- `->publicRoute()` — mark the route as intentionally public; also clears the operation-level OpenAPI `security` so it overrides any global scheme.

```php
$r->get('/ping', $handler)
    ->publicRoute();

$r->post('/articles', $handler)
    ->permission(static fn () => current_user_can('edit_posts'));

$r->post('/secure/articles', $handler)
    ->protectedByMiddleware('bearerAuth');

$r->post('/webhooks/intake', $handler)
    ->publicRoute();
```

Resource-backed endpoints already enforce their own `ResourcePolicy` and are unaffected.

## Common mistakes

- Class-string middleware requiring constructor args without `middlewareFactory`
- Missing explicit route intent on any route (returns `403` — write methods since v0.4.0, `GET`/`OPTIONS` since v1.1.0)
- Registering outside `rest_api_init` without custom dispatcher (fails loudly since v1.1.0 instead of silently doing nothing)

## Validation checklist

- middleware order is `global -> group -> route`
- generated route URIs are normalized (`/x` not `//x/`)
- `contracts(true)` excludes `openapi.include=false`
- every route declares intent via `permission()`, `protectedByMiddleware()`, or `publicRoute()`

## v1.1.0 behavior changes

- **Deny-by-default for every method.** Raw `Router` routes without an explicit permission callback now fail with `403` regardless of HTTP method — `GET` and `OPTIONS` included. Declare intent with `permission()`, `protectedByMiddleware()`, or `publicRoute()` on every route.
- **`group()` unwinds safely after exceptions.** A callback that throws no longer leaves the group prefix/middleware stack corrupted for subsequent registrations.
- **Handler resolution supports static and union-typed callables.** `[Controller::class, 'method']` with a static method is invoked without instantiation; a union-typed first parameter that accepts `RequestContext` receives the context. Handlers may require at most two parameters, nonexistent classes/methods fail with a clear `InvalidArgumentException`, and handler classes needing constructor arguments are rejected with instructions to pass an instance.
- **Registration fails loudly.** `WordPressRestDispatcher` throws a `RuntimeException` when `register()` runs outside `rest_api_init` or when WordPress core rejects a route, instead of silently dropping it.
- **Route-aware WordPress middleware.** Middleware implementing `WordPressRouteMiddlewareInterface` (e.g. `CorsMiddleware`) is announced its namespace/URI at `register()` time — this powers the [WordPress CORS bridge](../public-client/cors) that answers preflight before dispatch.

## v0.6.0 behavior changes

- `Router::dispatch()` now stores normalized route metadata under `RequestContext::$attributes['routeMeta']`. This is what powers route-level normalizer selection — for example, the [OAuth error format](../public-client/oauth-error-format) opt-in works because `ResponseNormalizer` reads `routeMeta.error_format` from the context. Existing handlers ignore the new attribute; no migration needed.

## v0.5.0 behavior changes

- `Router::options(string $uri, mixed $handler): RouteBuilder` registers explicit `OPTIONS` routes for CORS preflight. ~~`OPTIONS` permissions default to public~~ *(superseded in v1.1.0: `OPTIONS` routes deny by default like every other method, and preflight is normally handled by the [WordPress CORS bridge](../public-client/cors) before dispatch — explicit `OPTIONS` routes are no longer required for CORS).*
- See [Public-Client APIs](../public-client/overview) for the recommended pipeline order.

## v0.4.0 behavior changes

- Write methods (`POST`/`PUT`/`PATCH`/`DELETE`) registered on the raw `Router` without an explicit permission callback now deny by default. `GET` stays public by default.
- New `RouteBuilder::publicRoute()` and `RouteBuilder::protectedByMiddleware()` helpers make route intent explicit at the call site.
- Per-operation `security: []` now overrides `globalSecurity` in the OpenAPI exporter (see [OpenAPI Overview](../openapi/overview)).

## v0.3.0 behavior changes

- Inbound `X-Request-ID` is accepted only if it matches `^[A-Za-z0-9._:-]{1,128}$`. Anything else is replaced with a generated `req_<hex>` id.
- For Resource and Woo handlers, `id` is read from URL route params first; query/body `id` is consulted only when the URL does not provide one.
