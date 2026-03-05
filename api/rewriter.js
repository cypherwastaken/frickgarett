export function rewriteJS(source){
let code=source;

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
window.__prox_loc=function(x){return x};
window.__prox_rewrite=function(x){
if(typeof x!=="string")return x;
return x;
};
})();`;

return runtime+code;
}
