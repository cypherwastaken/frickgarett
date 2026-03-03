export const runtime = "edge";

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");

  if (!target) {
    return new Response("Missing ?url=", { status: 400 });
  }

  const targetUrl = new URL(target);

  // Clone headers
  const headers = new Headers(req.headers);
  headers.delete("host");

  const response = await fetch(targetUrl.toString(), {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers(response.headers);

  // Rewrite redirects to go back through proxy
  const location = responseHeaders.get("location");
  if (location) {
    const absolute = new URL(location, targetUrl).toString();
    responseHeaders.set(
      "location",
      `/api/proxy?url=${encodeURIComponent(absolute)}`
    );
  }

  const contentType = responseHeaders.get("content-type") || "";

  // If HTML, rewrite asset URLs
  if (contentType.includes("text/html")) {
    let html = await response.text();

    html = html.replace(
      /(src|href)=["']([^"']+)["']/gi,
      (match, attr, url) => {
        try {
          const absoluteUrl = new URL(url, targetUrl).toString();
          return `${attr}="/api/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
        } catch {
          return match;
        }
      }
    );

    return new Response(html, {
      status: response.status,
      headers: responseHeaders,
    });
  }

  // For JS, CSS, images, fonts, etc → just stream
  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
