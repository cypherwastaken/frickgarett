export default async function handler(req, res) {
  try {
    let { url } = req.query;

    if (!url) {
      return res.status(400).send("Missing ?url=");
    }

    url = decodeURIComponent(url);
    const target = new URL(url);

    const blockedHosts = ["localhost", "127.0.0.1"];
    if (blockedHosts.includes(target.hostname)) {
      return res.status(403).send("Blocked host");
    }

    const forwardHeaders = {
      "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
      "accept": req.headers["accept"] || "*/*",
      "accept-language": req.headers["accept-language"] || "en-US,en;q=0.9",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "referer": target.origin
    };

    if (req.headers.cookie) {
      forwardHeaders["cookie"] = req.headers.cookie;
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20000);

    const response = await fetch(target.toString(), {
      method: req.method,
      headers: forwardHeaders,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req,
      redirect: "manual",
      signal: controller.signal
    });

    const location = response.headers.get("location");
    if (location) {
      const absolute = new URL(location, target.href).toString();
      res.setHeader("location", `/api/prox?url=${encodeURIComponent(absolute)}`);
      return res.status(response.status).end();
    }

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

    const raw = response.headers.raw ? response.headers.raw() : null;
    if (raw && raw["set-cookie"]) {
      res.setHeader("set-cookie", raw["set-cookie"]);
    }

    res.setHeader("cache-control", "public, max-age=3600");

    const contentType = response.headers.get("content-type") || "";

    const rewriteUrl = (link) => {
      try {
        if (!link) return link;
        if (link.startsWith("data:") || link.startsWith("javascript:")) return link;
        const absolute = new URL(link, target.href).href;
        return `/api/prox?url=${encodeURIComponent(absolute)}`;
      } catch {
        return link;
      }
    };

    if (contentType.includes("text/html")) {
      let html = await response.text();

      html = html.replace(/<base[^>]+>/gi, "");

      html = html.replace(
        /(src|href|data-src|data-href|data-url|poster|action)=["']([^"']+)["']/gi,
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
        (match, start, link, end) => `${start}${rewriteUrl(link)}${end}`
      );

      html = html.replace(
        /<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;URL=([^"']+)["']/gi,
        (match, link) => match.replace(link, rewriteUrl(link))
      );

      html = html.replace(
        /(window\.location|location\.href|document\.location|top\.location|parent\.location)\s*=\s*["']([^"']+)["']/gi,
        (match, prop, link) => `${prop}="${rewriteUrl(link)}"`
      );

      html = html.replace(
        /window\.open\(["']([^"']+)["']/gi,
        (match, link) => `window.open("${rewriteUrl(link)}"`
      );

      html = html.replace(
        /fetch\(["']([^"']+)["']/gi,
        (match, link) => `fetch("${rewriteUrl(link)}"`
      );

      html = html.replace(
        /new WebSocket\(["']([^"']+)["']/gi,
        (match, link) => `new WebSocket("${rewriteUrl(link)}"`
      );

      html = html.replace(
        /url\(["']?([^"')]+)["']?\)/gi,
        (match, link) => `url("${rewriteUrl(link)}")`
      );

      const injected = `
<script>
(function(){
document.title="New Tab";
const prox=function(url){
try{
if(!url)return url;
if(url.startsWith("data:")||url.startsWith("javascript:"))return url;
return "/api/prox?url="+encodeURIComponent(new URL(url,location.href));
}catch{return url;}
};
const origFetch=window.fetch;
window.fetch=function(input,init){
if(typeof input==="string"){input=prox(input);}
else if(input&&input.url){input=new Request(prox(input.url),input);}
return origFetch(input,init);
};
const origOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...rest){
return origOpen.call(this,method,prox(url),...rest);
};
const origPush=history.pushState;
history.pushState=function(state,title,url){
if(url)url=prox(url);
return origPush.call(this,state,title,url);
};
const origReplace=history.replaceState;
history.replaceState=function(state,title,url){
if(url)url=prox(url);
return origReplace.call(this,state,title,url);
};
const origAssign=window.location.assign;
window.location.assign=function(url){
origAssign.call(window.location,prox(url));
};
})();
</script>
`;

      html = html.replace("<head>", "<head>" + injected);

      res.setHeader("content-type", "text/html");
      return res.send(html);
    }

    if (contentType.includes("text/css")) {
      let css = await response.text();

      css = css.replace(
        /url\(["']?([^"')]+)["']?\)/gi,
        (match, link) => `url("${rewriteUrl(link)}")`
      );

      res.setHeader("content-type", "text/css");
      return res.send(css);
    }

    if (response.body) {
      const reader = response.body.getReader();
      res.status(response.status);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }

      return res.end();
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);

  } catch (err) {
    res.status(500).send("Proxy failed: " + err.message);
  }
}
