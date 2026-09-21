---
title: Application Password Auth
---

Use HTTP Basic credentials backed by WordPress Application Passwords.

## Minimal example

```php
use BetterRoute\Middleware\Auth\ApplicationPasswordAuthMiddleware;

$appPassword = new ApplicationPasswordAuthMiddleware();
```

Expected header format:

`Authorization: Basic base64(username:application_password)`

## Behavior

- Invalid/missing Authorization header -> `401`
- Invalid credentials -> `401 invalid_credentials`
- On success, the authenticated WP user is bound during downstream execution and the previous user is restored in `finally` (1.1.1), including exceptions

## Scenario: machine-to-machine integration

- API client stores app password credential
- middleware authenticates and sets user context
- enforce capabilities inside the authenticated pipeline; WordPress route permission callbacks run before middleware

## Common mistakes

- Sending Bearer token to this middleware
- Invalid base64 or missing `username:password` separator
- Forgetting to keep credentials per integration identity

## Validation checklist

- successful auth sets `auth.provider=application_password`
- invalid header returns deterministic error code
- least-privilege user is used for app password

## WordPress request authentication versus middleware

`protectedByMiddleware()` only lets a route reach its middleware; attach authentication and authorization as well. If native WordPress Application Password authentication has already established the request user, a WordPress permission callback can check that native identity. A user established only by Better Route middleware is available downstream, then restored before WordPress response filters and `_embed` processing.

For custom identity adapters, pair `setCurrentUser` with the appended optional `getCurrentUser` callback. See [auth scope](overview#native-user-scope-111).
