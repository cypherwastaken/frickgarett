# FrickGarett API Documentation

This document explains how to use the public proxy endpoint:

```
https://frickgarett.vercel.app/api/prox
```

It is designed to forward requests through a server-side proxy, rewrite links in HTML responses, and help bypass common frontend CORS limitations.

---

## Overview

The proxy works by:

- Accepting a target URL via the `?url=` query parameter
- Forwarding the request to that URL
- Rewriting links in HTML so that subsequent requests continue going through the proxy
- Returning the response back to your frontend

This allows you to load external websites or resources through a controlled server endpoint.

---

## Base Endpoint

```
https://frickgarett.vercel.app/api/prox?url=<ENCODED_TARGET_URL>
```

You must URL-encode the target URL before passing it.

---

## Basic Usage

### Example 1: Load a Website Through FrickGarett

Instead of calling:

```
https://example.com
```

You call:

```
https://frickgarett.vercel.app/api/prox?url=https%3A%2F%2Fexample.com
```

In JavaScript:

```js
const target = "https://example.com";
const proxiedUrl =
  "https://frickgarett.vercel.app/api/prox?url=" +
  encodeURIComponent(target);

fetch(proxiedUrl)
  .then(res => res.text())
  .then(html => {
    document.documentElement.innerHTML = html;
  });
```

---

## Redirecting Frontend Requests

If your frontend normally makes requests like:

```js
fetch("https://api.thirdparty.com/data")
```

Change it to:

```js
const proxied = 
  "https://frickgarett.vercel.app/api/prox?url=" +
  encodeURIComponent("https://api.thirdparty.com/data");

fetch(proxied);
```

---

## Using With an `<iframe>`

You can load external sites into an iframe through the proxy:

```html
<iframe
  src="https://frickgarett.vercel.app/api/prox?url=https%3A%2F%2Fexample.com"
  width="100%"
  height="800"
></iframe>
```

---

## How It Handles HTML

For HTML responses, the proxy automatically:

- Rewrites `src`, `href`, `data-src`
- Rewrites `srcset`
- Rewrites `<form action="">`
- Rewrites `meta refresh`
- Rewrites `window.location`, `fetch`, `XMLHttpRequest`
- Injects a script to proxy dynamic navigation

This ensures navigation continues to flow through `/api/prox`.

---

## Supported Request Methods

The proxy forwards the original HTTP method:

- GET
- POST
- PUT
- DELETE
- Others supported by `fetch`

Headers such as:

- `User-Agent`
- `Accept`
- `Accept-Language`
- `Cookie` (if present)

are forwarded to the target server.

---

## Important Notes

1. Always use `encodeURIComponent()` when passing the `url` parameter.
2. Some websites may still block proxy access.
3. This proxy removes:
   - Content Security Policy headers
   - X-Frame-Options
   - Strict-Transport-Security
4. Large file downloads are supported but may impact performance.
5. Be aware of legal and terms-of-service implications when proxying third-party content.

---

## Production Recommendation

If you plan to use this in production:

- Consider deploying your own version of the proxy.
- Add authentication or rate limiting.
- Restrict allowed target domains if necessary.
- Monitor for abuse.

---

## Quick Integration Pattern

You can centralize proxy usage like this:

```js
function proxify(url) {
  return (
    "https://frickgarett.vercel.app/api/prox?url=" +
    encodeURIComponent(url)
  );
}

// Usage
fetch(proxify("https://example.com/api/data"));
```

---

## Summary

To use the proxy:

1. Take any external URL.
2. Encode it.
3. Append it to:

```
https://frickgarett.vercel.app/api/prox?url=
```

All navigation and resource loading will automatically continue through the proxy once the first request is made.

---

If you need a custom deployment, clone the proxy handler into your own Next.js API route and deploy it on your own infrastructure.
