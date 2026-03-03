export default async function handler(req, res) {
  try {
    let { url } = req.query;

    if (url) {
      url = decodeURIComponent(url);
    } else if (req.query._target) {
      url = decodeURIComponent(req.query._target);
    } else {
      if (!req.headers.referer) {
        return res.status(400).send("Missing ?url=");
      }
      const referer = new URL(req.headers.referer);
      url = referer.origin + referer.pathname + "?" + new URLSearchParams(req.query).toString();
    }

    const target = new URL(url);

    const response = await fetch(target.toString(), {
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

    if (contentType.includes("text/html")) {
      let html = await response.text();

      html = html.replace(
        /(src|href)=["']([^"']+)["']/gi,
        (match, attr, link) => {
          try {
            const absolute = new URL(link, target).toString();
            return `${attr}="/api/prox?url=${encodeURIComponent(absolute)}"`;
          } catch {
            return match;
          }
        }
      );

      html = html.replace(
        /<form[^>]+action=["']([^"']+)["']/gi,
        (match, action) => {
          try {
            const absolute = new URL(action, target).toString();
            return match.replace(action, `/api/prox?url=${encodeURIComponent(absolute)}`);
          } catch {
            return match;
          }
        }
      );

      html = html.replace(
        /<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;URL=([^"']+)["']/gi,
        (match, url) => {
          try {
            const absolute = new URL(url, target).toString();
            return match.replace(url, `/api/prox?url=${encodeURIComponent(absolute)}`);
          } catch {
            return match;
          }
        }
      );

      html = html.replace(
        /(window\.location|location\.href)\s*=\s*["']([^"']+)["']/gi,
        (match, prop, link) => {
          try {
            const absolute = new URL(link, target).toString();
            return `${prop}="/api/prox?url=${encodeURIComponent(absolute)}"`;
          } catch {
            return match;
          }
        }
      );

      html = html.replace(
        /fetch\(["']([^"']+)["']/gi,
        (match, link) => {
          try {
            const absolute = new URL(link, target).toString();
            return `fetch("/api/prox?url=${encodeURIComponent(absolute)}"`;
          } catch {
            return match;
          }
        }
      );

      res.setHeader("content-type", "text/html");
      return res.send(html);
    }

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
