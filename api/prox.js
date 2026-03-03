// /api/prox.js
export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send("Missing ?url=");

    const target = new URL(url);

    const response = await fetch(target.toString(), {
      redirect: "manual", // Important to handle redirects ourselves
    });

    // Handle HTTP redirects
    const location = response.headers.get("location");
    if (location) {
      const absolute = new URL(location, target).toString();
      // Rewrite redirect to go through the proxy
      res.setHeader(
        "location",
        `/api/prox?url=${encodeURIComponent(absolute)}`
      );
      return res.status(response.status).end();
    }

    const contentType = response.headers.get("content-type") || "";

    // Rewrite HTML links (href/src) so they go through proxy
    if (contentType.includes("text/html")) {
      let html = await response.text();

      html = html.replace(
        /(src|href)=["']([^"']+)["']/gi,
        (match, attr, link) => {
          try {
            // Convert relative URLs to absolute
            const absolute = new URL(link, target).toString();
            return `${attr}="/api/prox?url=${encodeURIComponent(absolute)}"`;
          } catch {
            return match;
          }
        }
      );

      res.setHeader("content-type", "text/html");
      return res.send(html);
    }

    // Otherwise (JS/CSS/images) just forward
    response.headers.forEach((value, key) => {
      if (!["content-encoding", "content-length", "location"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy failed: " + err.message);
  }
}
