/* Minimal browser runtime for the Claude Design ".dc.html" component format.
   Replaces support.js so the pages can run as plain static HTML.
   Supports: {{path}} interpolation, <sc-for list as>, <sc-if value>,
   data-on-click / data-on-change / data-on-input / data-on-submit handlers,
   <dc-import name prop="…"> child components (rendered in shadow DOM so each
   component keeps its own CSS, as on the canvas), DCLogic with props/state/setState. */
(function () {
  'use strict';
  const defs = {};
  const tplCache = {};

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state) : patch;
      this.state = Object.assign({}, this.state, next);
      if (this.__host) this.__host.render();
    }
    componentDidMount() {}
    renderVals() { return {}; }
  }
  window.DCLogic = DCLogic;

  const RE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const RE_WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

  function lookup(path, ctx) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    let v = ctx;
    for (const p of path.split('.')) { if (v == null) return undefined; v = v[p]; }
    return v;
  }
  function interp(s, ctx) {
    const m = s.match(RE_WHOLE);
    if (m) return lookup(m[1], ctx);
    return s.replace(RE, (_, p) => { const v = lookup(p, ctx); return v == null ? '' : String(v); });
  }
  const str = (v) => (v == null ? '' : String(v));

  function renderNodes(nodes, ctx, out) { for (const n of nodes) renderNode(n, ctx, out); }
  function renderNode(n, ctx, out) {
    if (n.nodeType === 3) {
      out.appendChild(document.createTextNode(n.data.includes('{{') ? str(interp(n.data, ctx)) : n.data));
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === 'SC-FOR') {
      const list = interp(n.getAttribute('list') || '', ctx);
      const as = n.getAttribute('as') || 'item';
      if (Array.isArray(list)) list.forEach((item, i) => {
        const c = Object.create(ctx); c[as] = item; c.$index = i;
        renderNodes(n.childNodes, c, out);
      });
      return;
    }
    if (tag === 'SC-IF') {
      if (interp(n.getAttribute('value') || '', ctx)) renderNodes(n.childNodes, ctx, out);
      return;
    }
    const el = n.cloneNode(false);
    const isImport = tag === 'DC-IMPORT';
    if (isImport) el.__dcProps = {};
    for (const a of Array.from(el.attributes)) {
      const name = a.name, val = a.value;
      if (name.startsWith('data-on-')) {
        const fn = interp(val, ctx);
        if (typeof fn === 'function') (el.__dcOn || (el.__dcOn = {}))[name.slice(8)] = fn;
        el.removeAttribute(name);
      } else if (isImport && name !== 'name') {
        el.__dcProps[name] = val.includes('{{') ? interp(val, ctx) : val;
        if (val.includes('{{')) el.setAttribute(name, str(el.__dcProps[name]));
      } else if (val.includes('{{')) {
        el.setAttribute(name, str(interp(val, ctx)));
      }
    }
    if (!isImport) renderNodes(n.childNodes, ctx, el);
    out.appendChild(el);
  }

  /* Index-based DOM morph: keeps existing nodes (and their state, e.g. a range
     slider mid-drag or a child component's shadow root) where tag names match. */
  function morph(from, to) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) { from.replaceWith(to); return; }
    if (from.nodeType === 3) { if (from.data !== to.data) from.data = to.data; return; }
    if (from.nodeType !== 1) return;
    for (const a of Array.from(from.attributes)) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
    for (const a of Array.from(to.attributes)) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
    from.__dcOn = to.__dcOn;
    if (from.nodeName === 'DC-IMPORT') { from.__dcProps = to.__dcProps; return; }
    if (from.nodeName === 'INPUT' && to.hasAttribute('value')) {
      const active = (from.getRootNode().activeElement === from);
      if (!active && from.value !== to.getAttribute('value')) from.value = to.getAttribute('value');
    }
    morphChildren(from, to);
  }
  function morphChildren(from, to) {
    const fc = Array.from(from.childNodes), tc = Array.from(to.childNodes);
    for (let i = 0; i < tc.length; i++) {
      if (i < fc.length) morph(fc[i], tc[i]); else from.appendChild(tc[i]);
    }
    for (let i = tc.length; i < fc.length; i++) fc[i].remove();
  }

  function bindEvents(root) {
    const dispatch = (type, e) => {
      let el = e.target;
      while (el && el !== root) {
        const on = el.__dcOn;
        if (on) {
          const field = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
          if (type === 'click' && on.click) return on.click(e);
          if (type === 'submit' && on.submit) return on.submit(e);
          if (type === 'input') { if (on.input) on.input(e); if (on.change && field) return on.change(e); }
          if (type === 'change' && on.change && !field) return on.change(e);
        }
        el = el.parentNode;
      }
    };
    for (const t of ['click', 'input', 'change', 'submit']) root.addEventListener(t, (e) => dispatch(t, e));
    // Preview site: forms have no backend yet, so stop the page reloading on submit.
    root.addEventListener('submit', (e) => {
      const f = e.target;
      if (f && f.tagName === 'FORM' && !f.getAttribute('action') && !f.dataset.gf) { e.preventDefault(); alert('Preview site: this form is not connected yet.'); }
    });
    // Mobile nav: the design's hamburger has no behaviour on the canvas; toggle the nav here.
    root.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.burger');
      if (!b) return;
      const nav = b.getRootNode().querySelector('.navmain');
      if (nav) nav.classList.toggle('open');
    });
  }

  function shallowEq(a, b) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
  }

  class Host {
    constructor(name, props, container, shadow) {
      const def = defs[name];
      if (!def) throw new Error('DC: unknown component ' + name);
      this.name = name; this.def = def;
      this.root = shadow ? container.attachShadow({ mode: 'open' }) : container;
      if (shadow && def.css) { const s = document.createElement('style'); s.textContent = def.css; this.root.appendChild(s); }
      this.body = document.createElement('div');
      this.body.setAttribute('data-dc', name);
      this.body.style.display = 'contents';
      this.root.appendChild(this.body);
      const Logic = def.logic || DCLogic;
      this.inst = new Logic(Object.assign({}, def.defaults, props));
      this.inst.__host = this;
      bindEvents(this.root);
      this.render();
      if (this.inst.componentDidMount) this.inst.componentDidMount();
    }
    setProps(p) {
      const np = Object.assign({}, this.def.defaults, p);
      if (!shallowEq(np, this.inst.props)) { this.inst.props = np; this.render(); }
    }
    render() {
      const vals = this.inst.renderVals() || {};
      if (!tplCache[this.name]) { const t = document.createElement('template'); t.innerHTML = this.def.template; tplCache[this.name] = t; }
      const frag = document.createDocumentFragment();
      renderNodes(tplCache[this.name].content.childNodes, vals, frag);
      morphChildren(this.body, frag);
      this.body.querySelectorAll('dc-import').forEach((el) => {
        const props = el.__dcProps || {};
        if (el.__host) el.__host.setProps(props);
        else el.__host = new Host(el.getAttribute('name'), props, el, true);
      });
    }
  }

  window.DC = {
    define(name, def) { defs[name] = def; },
    mount(container, name, props) { return new Host(name, props || {}, container, false); }
  };
})();
