---
title: Trusted Proxy IP Resolution
---

`TrustedProxyClientIpResolver` *(v0.6.0)* resolves the real client IP behind Cloudflare, an AWS load balancer, or any other proxy chain. It only honours forwarded headers when the immediate connection comes from a trusted CIDR, so unauthenticated callers cannot spoof their IP by setting `X-Forwarded-For`.

`Http\ClientIpResolver` (since 0.3.0) keeps working — its constructor and `resolve(?array $server = null)` API are unchanged. Internally it now delegates to `TrustedProxyClientIpResolver`, which means the same hardening rules apply to existing 0.3.x callers.

For new code, prefer `TrustedProxyClientIpResolver` directly — it implements `ClientIpResolverInterface` and slots into `RateLimitMiddleware` and `IpAllowlistMiddleware` cleanly.

**Since 1.0.0:** when `REMOTE_ADDR` is trusted, the resolver reads a forwarded header by walking it **right-to-left** and returning the first address that is **not** itself a trusted proxy — the closest untrusted hop. Earlier versions returned the left-most entry, which a client can forge behind an *appending* proxy (e.g. nginx `proxy_add_x_forwarded_for` appends the real peer, leaving any client-supplied value to its left). The old behavior let a caller spoof its IP and defeat `IpAllowlistMiddleware`, rate-limit buckets, and audit IPs. Single-value overwriting headers such as `CF-Connecting-IP` are unaffected.

## Minimal example

```php
use BetterRoute\Middleware\Network\TrustedProxyClientIpResolver;

$resolver = new TrustedProxyClientIpResolver(
    trustedProxyCidrs: [
        '173.245.48.0/20',  // Cloudflare
        '103.21.244.0/22',
        '2400:cb00::/32',
    ],
    forwardedHeaders: ['CF-Connecting-IP', 'X-Forwarded-For']
);

$clientIp = $resolver->resolve();
```

Pass it to `RateLimitMiddleware` for proxy-aware rate-limit keys:

```php
use BetterRoute\Middleware\RateLimit\RateLimitMiddleware;
use BetterRoute\Middleware\RateLimit\TransientRateLimiter;

$rateLimit = new RateLimitMiddleware(
    limiter: new TransientRateLimiter(),
    limit: 60,
    windowSeconds: 60,
    clientIpResolver: $resolver
);
```

`RateLimitMiddleware`'s `$clientIpResolver` argument now accepts either the legacy `Http\ClientIpResolver` or any `Middleware\Network\ClientIpResolverInterface`.

*(v1.1.0)* The resolved IP is only the rate-limit fallback identity — authenticated callers (WP user, JWT subject, HMAC key id) are scoped by identity instead. `TransientRateLimiter` in its default WordPress configuration now serializes counter updates with a MySQL advisory lock rather than a racy read/modify/write.

## Constructor

```php
new TrustedProxyClientIpResolver(
    array $trustedProxyCidrs = [],
    array $forwardedHeaders = ['CF-Connecting-IP', 'X-Forwarded-For'],
    ?callable $serverResolver = null
);
```

- `trustedProxyCidrs` — list of IPv4/IPv6 CIDRs **or** single IPs. Each entry is validated at construction.
- `forwardedHeaders` — header order the resolver consults when `REMOTE_ADDR` is trusted. The first header that yields a valid IP wins.
- `serverResolver` — defaults to a callable returning `$_SERVER`. Inject in tests.

## Behavior

| `REMOTE_ADDR` | Trusted? | Forwarded headers present? | Result |
|---|---|---|---|
| missing/invalid | — | — | `null` |
| outside `trustedProxyCidrs` | no | — | `REMOTE_ADDR` returned (forwarded headers ignored) |
| inside `trustedProxyCidrs` | yes | at least one untrusted hop | closest untrusted hop — the right-most IP that is **not** in `trustedProxyCidrs` — from the first matching header |
| inside `trustedProxyCidrs` | yes | none parseable, or every hop trusted | `REMOTE_ADDR` returned |

`X-Forwarded-For` is comma-delimited. **Since 1.0.0** the resolver walks it right-to-left and returns the first IP that is not one of your `trustedProxyCidrs` (the closest untrusted hop), rather than the left-most entry — the left-most value is attacker-controllable behind an appending proxy. If every hop is trusted, `REMOTE_ADDR` is returned.

The resolver checks the request object first (`$request->get_header($header)`) when one is passed in, then falls back to `$_SERVER`. Both `Header-Name` and `HTTP_HEADER_NAME` shapes are accepted.

## CIDR matching

`BetterRoute\Middleware\Network\CidrMatcher` handles the IPv4/IPv6 math. CIDRs without a `/prefix` are treated as single hosts (`/32` for IPv4, `/128` for IPv6). The matcher rejects malformed input at construction:

- `192.0.2.0/24` ✓
- `2400:cb00::/32` ✓
- `203.0.113.5` (single host) ✓
- `300.0.0.0/24` ✗ — not a valid IP
- `192.0.2.0/40` ✗ — prefix out of range

Use `CidrMatcher::matches($ip, $cidr)` and `CidrMatcher::assertValid($cidr)` if you need the same logic outside the resolver.

## Validation checklist

- a request with `REMOTE_ADDR` from outside the trusted CIDR returns `REMOTE_ADDR` (proxy headers ignored);
- a request from a trusted proxy with `CF-Connecting-IP: 203.0.113.5` returns `203.0.113.5`;
- a request from a trusted proxy with `X-Forwarded-For: 1.2.3.4, 203.0.113.5, 173.245.48.1` (trailing hop is a trusted Cloudflare IP) returns `203.0.113.5` — the trusted hop is skipped and the spoofable left-most `1.2.3.4` is ignored;
- a malformed CIDR in the constructor throws `InvalidArgumentException`.

## Common mistakes

- Passing the proxy's actual IP into `forwardedHeaders` thinking it is a CIDR — it must be a header **name** (e.g. `CF-Connecting-IP`).
- Trusting every CIDR ("just to be safe"). Each entry is a delegation of trust — only list the proxy ranges you control or rely on.
- Letting `Http\ClientIpResolver` be constructed without `trustedProxies`. With an empty list, every header is ignored and only `REMOTE_ADDR` is returned. That is safer than the default WP behavior, but you still need to populate the list to actually use forwarded IPs.
