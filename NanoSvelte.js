export const CSSReset = `html,body,p,ol,ul,li,dl,dt,dd,blockquote,figure,fieldset,legend,textarea,pre,iframe,hr,h1,h2,h3,h4,h5,h6{margin:0;padding:0}h1,h2,h3,h4,h5,h6{font-size:100%;font-weight:normal}ul{list-style:none}button,input,select{margin:0}html{box-sizing:border-box}*,*::before,*::after{box-sizing:inherit}img,video{height:auto;max-width:100%}iframe{border:0}table{border-collapse:collapse;border-spacing:0}td,th{padding:0}`;    

// event bus
export const B = {
  events: {},
  on(event, listener) {(this.events[event] || (this.events[event] = [])).push(listener)},
  off(event, listener) {this.events[event] && (this.events[event] = this.events[event].filter(l => l !== listener))},
  emit(event, data) {this.events[event]?.forEach(listener => listener(data))}
};

// element builder
export function E(tag, props = {}, ...children) {
  function assignDeep(e, p){
    Object.entries(p).forEach(([k, v]) => 
      typeof v === 'object' ? assignDeep(e[k], v) : e.setAttribute(k, v));
  }
  function html2node(c){
    const tempDiv = document.createElement('div'); tempDiv.innerHTML = c;
    const f = document.createDocumentFragment();
    f.append(...tempDiv.childNodes);
    return f;
  }
  const e = document.createElement(tag);
  const $ = Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith('$')).map(([key, value]) => (delete props[key], [key.slice(1), value])));
  assignDeep.call(this, e, props);
  e.append(...children.map(c => typeof c === 'string' ? html2node(c) : typeof c==='object' && c.nodeType===undefined ? E.bind(this)(c.t, c.p, ...c.c) : c));
  if(this?.elements && props.id) this.elements[props.id] = e;
  return e;
};

// component builder
export function C(name, {html=null, script=null, style=null, extending=HTMLElement, observedAttributes=[]}={}) {
  const lst = (v) => Array.isArray(v) || v instanceof NodeList ? Array.from(v) : [v];
  const A2E = ({t, p, c}, E) => E(t, p, ...c.map(e => Array.isArray(e) ? A2E(e, E) : e));
  customElements.define(name, class _ extends extending {
      static observedAttributes = observedAttributes;
      attributes = {};
      elements = {};
      slots = [];
      constructor() { super() }
      attributeChangedCallback(name, _oldVal, newVal) { this.attributes[name] = newVal }
      connectedCallback(){
          setTimeout(()=>{ // this delay ensures the slot elements are created
              this.slots = this.querySelectorAll('slot');
              const shadow = this.attachShadow({ mode: "open" });
              if(html) lst(html).forEach(e=>{
                shadow.appendChild(
                  typeof e === 'object' && e.nodeType === undefined
                    ? A2E.call(this, e, E.bind(this))
                    : typeof e === 'function'
                      ? e.call(this, {E: E.bind(this), $: this.elements, ctx: this})
                      : e
              )});
              if(style) lst(style).forEach(e=>shadow.appendChild(E.bind(this)('style', {}, typeof e === 'function' ? e.call(this, {$: this.elements, ctx: this}) : e)));
              if(script) lst(script).forEach(e=>e.call(this, {doc: shadow, E: E.bind(this), B, $: this.elements, ctx: this}));
          })
      }
  })
}

// HTMLElement converter
export function E2TPC(e) {
  const t = e.tagName.toLowerCase();
  const p = Object.fromEntries(Array.from(e.attributes).map(a => [a.name, a.value]));
  const c = Array.from(e.childNodes).map(ce => {
    if (ce.nodeType === Node.ELEMENT_NODE) return E2TPC(ce);
    else if (ce.nodeType === Node.TEXT_NODE) return ce.textContent.trim();
  }).filter(ce=>ce);
  return {t, p, c};
}

// automatic template parser "sveltify"
export function S(ctx=document, selector='template[type=component][name]'){
  ctx.querySelectorAll(selector).forEach(e=>{
    const name = e.getAttribute('name');
    const inner = [...ctx.createRange().createContextualFragment(e.innerHTML).children];
    const html = inner.filter(e=>!['SCRIPT', 'STYLE', '#text'].includes(e.nodeName)).map(e=>E2TPC(e));
    const style = inner.filter(e=>e.nodeName === 'STYLE').map(e=>e.textContent);
    const script = inner.filter(e=>e.nodeName === 'SCRIPT').map(e=>new Function('{doc, E, B, $, ctx}', e.textContent));
    C(name, {html, script, style});
  });
}
