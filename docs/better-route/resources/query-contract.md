---
title: Query Contract
---

Resource list endpoints are strict by design.

## Supported query parameters

- `fields`: comma-separated projection
- `sort`: field or `-field`
- `page`: positive integer
- `per_page`: positive integer, capped by `maxPerPage`
- declared filters only (from `filters([...])`)

## Strict behavior

- Unknown param -> `400 validation_failed`
- Unknown field in `fields` -> `400 validation_failed`
- Unsupported sort field -> `400 validation_failed`
- Offset greater than `maxOffset` -> `400 validation_failed`

## Deterministic ordering (v1.1.0)

List results are stably ordered: the primary key (table resources) or `ID` (CPT resources) is appended as a tie-breaker to every sort, and it is the default order when no `sort` is requested (CPT default: `date` + `ID`). Identical sort values no longer cause rows to swap between pages.

## Typed filter schema

`filterSchema()` supports:

- `string`
- `int`
- `float`
- `bool`
- `date` (normalized to ISO-8601)
- `enum` with `values`

## Error example

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Invalid request.",
    "requestId": "req_123",
    "details": {
      "fieldErrors": {
        "foo": ["unknown parameter"]
      }
    }
  }
}
```

## Validation checklist

- negative/zero `page` and `per_page` rejected
- `per_page` above cap rejected
- typed filter coercion works as expected
