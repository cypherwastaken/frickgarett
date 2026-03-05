import { parse } from "oxc-parser"
import { walk } from "oxc-walker"

export function rewriteJS(source) {
  const ast = parse(source, { sourceType: "module", ecmaVersion: "latest" })
  const edits = []

  function wrap(start, end, text) {
    edits.push({ start, end, text })
  }

  walk(ast, {
    MemberExpression(node) {
      const obj = node.object
      const prop = node.property

      if (!obj || !prop) return

      const base =
        obj.type === "Identifier" &&
        ["window", "self", "globalThis", "parent", "top"].includes(obj.name)

      const isLocation =
        prop.type === "Identifier" &&
        prop.name === "location"

      if (base && isLocation) {
        wrap(node.start, node.end, `__prox_loc(${source.slice(node.start, node.end)})`)
      }

      const directLocation =
        obj.type === "Identifier" &&
        obj.name === "location"

      if (directLocation) {
        wrap(node.start, node.end, `__prox_loc(${source.slice(node.start, node.end)})`)
      }
    },

    Identifier(node) {
      if (node.name === "location") {
        wrap(node.start, node.end, "__prox_loc(location)")
      }
    },

    CallExpression(node) {
      const callee = node.callee

      if (callee.type === "Identifier" && callee.name === "eval") {
        const arg = node.arguments[0]
        if (!arg) return

        wrap(
          node.start,
          node.end,
          `eval(__prox_rewrite(${source.slice(arg.start, arg.end)}))`
        )
      }

      if (
        callee.type === "Identifier" &&
        callee.name === "Function"
      ) {
        const args = node.arguments
        if (args.length === 0) return

        const last = args[args.length - 1]

        wrap(
          last.start,
          last.end,
          `__prox_rewrite(${source.slice(last.start, last.end)})`
        )
      }
    },

    AssignmentExpression(node) {
      const left = node.left

      if (
        left.type === "Identifier" &&
        left.name === "location"
      ) {
        wrap(
          node.start,
          node.end,
          `__prox_set(${source.slice(node.start, node.end)})`
        )
      }
    }
  })

  edits.sort((a, b) => b.start - a.start)

  let output = source

  for (const edit of edits) {
    output =
      output.slice(0, edit.start) +
      edit.text +
      output.slice(edit.end)
  }

  const runtime = `
(function(){
if(window.__prox_loc)return
window.__prox_loc=function(x){return x}
window.__prox_set=function(x){try{return x}catch(e){return x}}
window.__prox_rewrite=function(x){
if(typeof x!=="string")return x
return x
}
})();
`

  return runtime + output
}
