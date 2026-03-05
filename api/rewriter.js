export function rewriteJS(source){
let code=source;

code=code.replace(/\bimport\((["'`])([^"'`]+)\1\)/g,(m,q,u)=>`import(${q}/api/prox?url=${encodeURIComponent(u)}${q})`);

code=code.replace(/\bfetch\((["'`])([^"'`]+)\1/g,(m,q,u)=>`fetch(${q}/api/prox?url=${encodeURIComponent(u)}${q}`);

code=code.replace(/new\s+WebSocket\((["'`])([^"'`]+)\1/g,(m,q,u)=>`new WebSocket(${q}/api/prox?url=${encodeURIComponent(u)}${q}`);

code=code.replace(/\blocation\b/g,"__prox_loc(location)");

code=code.replace(/window\.location/g,"__prox_loc(window.location)");
code=code.replace(/self\.location/g,"__prox_loc(self.location)");
code=code.replace(/top\.location/g,"__prox_loc(top.location)");
code=code.replace(/parent\.location/g,"__prox_loc(parent.location)");

code=code.replace(/eval\(([^)]+)\)/g,"eval(__prox_rewrite($1))");

code=code.replace(/Function\(([^)]+)\)/g,(m,args)=>{
let parts=args.split(",");
if(parts.length===0)return m;
let last=parts.pop();
return "Function("+parts.join(",")+(parts.length?",":"")+"__prox_rewrite("+last+"))";
});

const runtime=`(function(){
if(window.__prox_loc)return;
const prox=function(u){
try{
if(!u)return u;
if(u.startsWith("data:")||u.startsWith("javascript:"))return u;
return "/api/prox?url="+encodeURIComponent(new URL(u,location.href));
}catch{return u}
};
window.__prox_loc=function(x){return x};
window.__prox_rewrite=function(x){
if(typeof x!=="string")return x;
return x.replace(/(https?:\\/\\/[^"'\\s]+)/g,function(m){return prox(m)});
};
const f=window.fetch;
window.fetch=function(i,o){
if(typeof i==="string")i=prox(i);
else if(i&&i.url)i=new Request(prox(i.url),i);
return f(i,o);
};
})();`;

return runtime+code;
}
