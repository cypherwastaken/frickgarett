export default async function handler(req, res) {
  try {
    let { url } = req.query;

    if (!url) {
      return res.status(400).send("Missing ?url=");
    }

    url = decodeURIComponent(url);
    const target = new URL(url);

    const forwardHeaders = {
      "user-agent": req.headers["user-agent"] || "",
      "accept": req.headers["accept"] || "*/*",
      "accept-language": req.headers["accept-language"] || "en-US,en;q=0.9",
      "referer": target.origin,
    };

    if (req.headers.cookie) {
      forwardHeaders["cookie"] = req.headers.cookie;
    }

    const response = await fetch(target.toString(), {
      method: req.method,
      headers: forwardHeaders,
      redirect: "manual",
    });

    const location = response.headers.get("location");
    if (location) {
      const absolute = new URL(location, target).toString();
      res.setHeader(
        "location",
        `/api/prox?url=${encodeURIComponent(absolute)}`
      );
      return res.status(response.status).end();
    }

    const contentType = response.headers.get("content-type") || "";

    const blockedHeaders = [
      "content-security-policy",
      "content-security-policy-report-only",
      "x-frame-options",
      "strict-transport-security",
      "content-encoding",
      "content-length",
      "location"
    ];

    response.headers.forEach((value, key) => {
      if (!blockedHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      res.setHeader("set-cookie", setCookie);
    }

    if (contentType.includes("text/html")) {
      let html = await response.text();

      const rewriteUrl = (link) => {
        try {
          if (!link || link.startsWith("data:") || link.startsWith("javascript:"))
            return link;
          const absolute = new URL(link, target).toString();
          return `/api/prox?url=${encodeURIComponent(absolute)}`;
        } catch {
          return link;
        }
      };

      html = html.replace(
        /(src|href|data-src)=["']([^"']+)["']/gi,
        (match, attr, link) => `${attr}="${rewriteUrl(link)}"`
      );

      html = html.replace(
        /srcset=["']([^"']+)["']/gi,
        (match, value) => {
          const rewritten = value
            .split(",")
            .map(part => {
              const [urlPart, size] = part.trim().split(/\s+/);
              return `${rewriteUrl(urlPart)}${size ? " " + size : ""}`;
            })
            .join(", ");
          return `srcset="${rewritten}"`;
        }
      );

      html = html.replace(
        /<form([^>]+action=["'])([^"']+)(["'])/gi,
        (match, start, link, end) =>
          `${start}${rewriteUrl(link)}${end}`
      );

      html = html.replace(
        /<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;URL=([^"']+)["']/gi,
        (match, link) =>
          match.replace(link, rewriteUrl(link))
      );

      html = html.replace(
        /(window\.location|location\.href)\s*=\s*["']([^"']+)["']/gi,
        (match, prop, link) =>
          `${prop}="${rewriteUrl(link)}"`
      );

      html = html.replace(
        /fetch\(["']([^"']+)["']/gi,
        (match, link) =>
          `fetch("${rewriteUrl(link)}"`
      );

      html = html.replace(
        /url\(["']?([^"')]+)["']?\)/gi,
        (match, link) =>
          `url("${rewriteUrl(link)}")`
      );

      res.setHeader("content-type", "text/html");
      return res.send(html);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy failed: " + err.message);
  }
}
