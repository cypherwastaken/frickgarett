import { rewriteJS } from "./rewriter.js"

export default async function handler(req,res){
try{
let {url}=req.query;
if(!url)return res.status(400).send("Missing ?url=");
url=decodeURIComponent(url);
const target=new URL(url);

const blockedHosts=["localhost","127.0.0.1"];
if(blockedHosts.includes(target.hostname))return res.status(403).send("Blocked host");

const forwardHeaders={
"user-agent":req.headers["user-agent"]||"Mozilla/5.0",
"accept":req.headers["accept"]||"*/*",
"accept-language":req.headers["accept-language"]||"en-US,en;q=0.9",
"sec-fetch-mode":"navigate",
"sec-fetch-site":"none",
"sec-fetch-user":"?1",
"upgrade-insecure-requests":"1",
"referer":target.origin
};
if(req.headers.cookie)forwardHeaders["cookie"]=req.headers.cookie;

const controller=new AbortController();
setTimeout(()=>controller.abort(),20000);

const response=await fetch(target.toString(),{
method:req.method,
headers:forwardHeaders,
body:["GET","HEAD"].includes(req.method)?undefined:req,
redirect:"manual",
signal:controller.signal
});

const location=response.headers.get("location");
if(location){
const absolute=new URL(location,target.href).toString();
res.setHeader("location",`/api/prox?url=${encodeURIComponent(absolute)}`);
return res.status(response.status).end();
}

const blockedHeaders=[
"content-security-policy",
"content-security-policy-report-only",
"x-frame-options",
"strict-transport-security",
"content-encoding",
"content-length",
"location"
];
response.headers.forEach((value,key)=>{
if(!blockedHeaders.includes(key.toLowerCase()))res.setHeader(key,value);
});
const raw=response.headers.raw?response.headers.raw():null;
if(raw&&raw["set-cookie"])res.setHeader("set-cookie",raw["set-cookie"]);
res.setHeader("cache-control","public, max-age=3600");

const contentType=response.headers.get("content-type")||"";

const rewriteUrl=(link)=>{
try{
if(!link)return link;
if(link.startsWith("data:")||link.startsWith("javascript:"))return link;
if(link.startsWith("/"))return `/api/prox?url=${encodeURIComponent(target.origin+link)}`;
const u=new URL(link,target.href);
if(u.hostname.endsWith(".tiktokcdn.com")||u.hostname.endsWith(".tiktokcdn-us.com"))u.hostname=u.hostname.replace(/.*\.tiktokcdn(-us)?\.com/,"www.tiktok.com");
return `/api/prox?url=${encodeURIComponent(u.href)}`;
}catch{return link;}
};

if(contentType.includes("text/html")){
let html=await response.text();
html=html.replace(/<base[^>]+>/gi,"");
html=html.replace(/(src|href|data-src|data-href|data-url|poster|action)=["']([^"']+)["']/gi,(m,a,l)=>`${a}="${rewriteUrl(l)}"`);
html=html.replace(/srcset=["']([^"']+)["']/gi,(m,v)=>v.split(",").map(p=>{const [u,s]=p.trim().split(/\s+/);return `${rewriteUrl(u)}${s?" "+s:""}`}).join(", "));
html=html.replace(/<form([^>]+action=["'])([^"']+)(["'])/gi,(m,s,l,e)=>`${s}${rewriteUrl(l)}${e}`);
html=html.replace(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;URL=([^"']+)["']/gi,(m,l)=>m.replace(l,rewriteUrl(l)));
html=html.replace(/(window\.location|location\.href|document\.location|top\.location|parent\.location)\s*=\s*["']([^"']+)["']/gi,(m,p,l)=>`${p}="${rewriteUrl(l)}"`);
html=html.replace(/window\.open\(["']([^"']+)["']/gi,(m,l)=>`window.open("${rewriteUrl(l)}"`);
html=html.replace(/fetch\(["']([^"']+)["']/gi,(m,l)=>`fetch("${rewriteUrl(l)}"`);
html=html.replace(/new WebSocket\(["']([^"']+)["']/gi,(m,l)=>`new WebSocket("${rewriteUrl(l)}"`);
html=html.replace(/url\(["']?([^"')]+)["']?\)/gi,(m,l)=>`url("${rewriteUrl(l)}")`);

const injected=`
<script>
(function(){
if(navigator.serviceWorker){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(s=>s.unregister()));}
const prox=function(u){try{if(!u)return u;if(u.startsWith("data:")||u.startsWith("javascript:"))return u;return "/api/prox?url="+encodeURIComponent(new URL(u,location.href))}catch{return u}};
const f=window.fetch;
window.fetch=function(i,o){if(typeof i==="string")i=prox(i);else if(i&&i.url)i=new Request(prox(i.url),i);return f(i,o)};
const o=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,u,...r){return o.call(this,m,prox(u),...r)};
const p=history.pushState;
history.pushState=function(s,t,u){if(u)u=prox(u);return p.call(this,s,t,u)};
const rp=history.replaceState;
history.replaceState=function(s,t,u){if(u)u=prox(u);return rp.call(this,s,t,u)};
const la=window.location.assign;
window.location.assign=function(u){la.call(window.location,prox(u))};
})();
</script>
`;
html=html.replace("<head>","<head>"+injected);
res.setHeader("content-type","text/html");
return res.send(html);
}

if(contentType.includes("javascript")){
let js=await response.text();
js=rewriteJS(js);
res.setHeader("content-type","application/javascript");
return res.send(js);
}

if(contentType.includes("text/css")){
let css=await response.text();
css=css.replace(/url\(["']?([^"')]+)["']?\)/gi,(m,l)=>`url("${rewriteUrl(l)}")`);
res.setHeader("content-type","text/css");
return res.send(css);
}

if(response.body){
const reader=response.body.getReader();
res.status(response.status);
while(true){
const {done,value}=await reader.read();
if(done)break;
res.write(Buffer.from(value));
}
return res.end();
}

res.send(Buffer.from(await response.arrayBuffer()));
}catch(err){
res.status(500).send("Proxy failed: "+err.message);
}
}
