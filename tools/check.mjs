// Static checks for the built app script (run by `node build.mjs --check`):
//  - every call of t(), L() or tr() must reach the translation helpers, not a local
//    variable or parameter with the same name (that bug has happened before).
import * as acorn from 'acorn';

const NAMES = new Set(['t', 'L', 'tr']);

export function checkShadowing(code){
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const problems = [];
  // scope: Set of names declared in it; we only care about t / L / tr
  const declarePattern = (p, set) => {
    if(!p) return;
    if(p.type === 'Identifier'){ if(NAMES.has(p.name)) set.add(p.name); }
    else if(p.type === 'ObjectPattern') p.properties.forEach(x => declarePattern(x.type === 'RestElement' ? x.argument : x.value, set));
    else if(p.type === 'ArrayPattern') p.elements.forEach(x => declarePattern(x, set));
    else if(p.type === 'AssignmentPattern') declarePattern(p.left, set);
    else if(p.type === 'RestElement') declarePattern(p.argument, set);
  };
  // names declared directly in a block / function body (let/const/class/function declarations; var hoists to function)
  function hoist(body, set, fnLevel){
    for(const st of body){
      if(!st) continue;
      if(st.type === 'VariableDeclaration' && (st.kind !== 'var' || fnLevel)) st.declarations.forEach(d => declarePattern(d.id, set));
      if((st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') && st.id && NAMES.has(st.id.name)) set.add(st.id.name);
    }
    if(fnLevel){ // var anywhere inside, not crossing functions
      (function walkVar(n){
        if(!n || typeof n.type !== 'string') return;
        if(/Function/.test(n.type)) return;
        if(n.type === 'VariableDeclaration' && n.kind === 'var') n.declarations.forEach(d => declarePattern(d.id, set));
        for(const k in n){ const v = n[k]; if(Array.isArray(v)) v.forEach(walkVar); else if(v && typeof v.type === 'string') walkVar(v); }
      })({ type: 'Block', body });
    }
  }
  function walk(n, stack){
    if(!n || typeof n.type !== 'string') return;
    let scope = null;
    if(/Function/.test(n.type)){
      scope = new Set();
      n.params.forEach(p => declarePattern(p, scope));
      if(n.type === 'FunctionExpression' && n.id && NAMES.has(n.id.name)) scope.add(n.id.name);
      if(n.body.type === 'BlockStatement') hoist(n.body.body, scope, true);
    } else if(n.type === 'BlockStatement' || n.type === 'Program' || n.type === 'StaticBlock'){
      scope = new Set(); hoist(n.body, scope, n.type === 'Program');
    } else if(n.type === 'ForStatement' || n.type === 'ForInStatement' || n.type === 'ForOfStatement'){
      scope = new Set(); const d = n.init || n.left; if(d && d.type === 'VariableDeclaration') d.declarations.forEach(x => declarePattern(x.id, scope));
    } else if(n.type === 'CatchClause'){
      scope = new Set(); declarePattern(n.param, scope);
    }
    const st = scope ? [...stack, scope] : stack;
    if(n.type === 'CallExpression' && n.callee.type === 'Identifier' && NAMES.has(n.callee.name)){
      // the helpers live in the outermost function scope (the app's IIFE): index 2 (Program, IIFE body fn, IIFE block)
      const name = n.callee.name;
      for(let k = st.length - 1; k >= 0; k--){
        if(st[k].has(name)){ if(k > 2) problems.push({ line: n.loc.start.line, name }); break; }
      }
    }
    for(const k in n){
      if(k === 'loc') continue;
      const v = n[k];
      if(Array.isArray(v)) v.forEach(x => walk(x, st)); else if(v && typeof v.type === 'string') walk(v, st);
    }
  }
  walk(ast, []);
  return problems;
}
