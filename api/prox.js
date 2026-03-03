export const runtime = "edge";

export async function GET(request) {
  return proxy(request);
}

export async function POST(request) {
  return proxy(request);
}

async function proxy(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return new Response("Missing ?url=", { status: 400 });
  }

  const targetUrl = new URL(target);

  const headers = new Headers(request.headers);
  headers.delete("host");

  const response = await fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? request.body
        : undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers(response.headers);

  // Fix redirects
  const location = responseHeaders.get("location");
  if (location) {
    const absolute = new URL(location, targetUrl).toString();
    responseHeaders.set(
      "location",
      `/api/proxy?url=${encodeURIComponent(absolute)}`
    );
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
