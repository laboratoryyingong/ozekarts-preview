/* OZ EKARTS forms → Gravity Forms REST API v2.
   A <form data-gf="ID"> is posted to GF_BASE/forms/ID/submissions. Inputs are named exactly like GF inputs
   (input_3, input_1.3, input_79.1 …). Validation messages come back per field id and are shown under the
   matching [data-field="ID"] wrapper; a valid submission is replaced by GF's own confirmation message.
   Conditional groups: [data-when="66=Grand Prix (12+ yrs old)|Rapid Racing (12+ yrs old)"] shows when the
   named input has one of the values; [data-when-not="…"] hides; hidden groups are cleared before posting. */
(function () {
  'use strict';
  const GF_BASE = 'https://ozekarts.com.au/wp-json/gf/v2';       // move to the admin subdomain at launch
  const RECAPTCHA_SITE_KEY = '6Ldt3_ktAAAAAEY6ojIR_EP2bIx-SeJ-ZQoqhnI7'; // v2 checkbox, 'OZ EKARTS website' key (Oct 2026) — same pair goes into the GF reCAPTCHA add-on
  const widgets = new Map();

  function q(root, sel) { return Array.from(root.querySelectorAll(sel)); }
  function valueOf(form, name) {
    const els = q(form, '[name="' + name + '"]');
    for (const el of els) { if (el.type === 'radio' || el.type === 'checkbox') { if (el.checked) return el.value; } else return el.value; }
    return '';
  }
  function applyConditions(form) {
    // Hidden groups are cleared so groups that depend on them collapse too (mirrors GF's conditional logic).
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      q(form, '[data-when],[data-when-not]').forEach((g) => {
        const test = (expr) => { const [name, vals] = expr.split('='); return vals.split('|').includes(valueOf(form, name)); };
        let show = true;
        if (g.dataset.when) show = test(g.dataset.when);
        if (g.dataset.whenNot && test(g.dataset.whenNot)) show = false;
        if (g.hidden === show) changed = true;
        g.hidden = !show;
        q(g, 'input,select,textarea').forEach((el) => {
          el.disabled = !show;
          if (!show) { if (el.type === 'radio' || el.type === 'checkbox') { if (el.checked) { el.checked = false; changed = true; } } else if (el.value && el.type !== 'file') { el.value = ''; changed = true; } }
        });
      });
      if (!changed) break;
    }
  }
  function setStatus(form, html, kind) {
    let box = form.querySelector('.oze-status');
    if (!box) { box = document.createElement('div'); box.className = 'oze-status'; form.appendChild(box); }
    box.className = 'oze-status ' + (kind || '');
    box.innerHTML = html; box.hidden = !html;
  }
  function clearErrors(form) { q(form, '.oze-err').forEach((e) => e.remove()); q(form, '.is-invalid').forEach((e) => e.classList.remove('is-invalid')); }
  function showErrors(form, messages) {
    let first = null;
    Object.entries(messages || {}).forEach(([id, msg]) => {
      const wrap = form.querySelector('[data-field="' + id + '"]');
      const err = document.createElement('div'); err.className = 'oze-err'; err.textContent = msg;
      if (wrap) { wrap.appendChild(err); wrap.classList.add('is-invalid'); first = first || wrap; }
      else setStatus(form, msg, 'error');
    });
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  async function submit(form) {
    const id = form.dataset.gf, btn = form.querySelector('[type="submit"],button:not([type])');
    clearErrors(form); setStatus(form, '', '');
    applyConditions(form);
    const fd = new FormData();
    q(form, 'input,select,textarea').forEach((el) => {
      if (el.disabled || !el.name) return;
      if (el.type === 'file') { if (el.files[0]) fd.append(el.name, el.files[0]); return; }
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      if (el.type === 'date' && el.value) { const [y, m, d] = el.value.split('-'); fd.append(el.name, d + '/' + m + '/' + y); return; }   // GF dmy
      if (el.type === 'time' && el.value) { let [h, mi] = el.value.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; fd.append(el.name + '[]', String(h)); fd.append(el.name + '[]', String(mi).padStart(2, '0')); fd.append(el.name + '[]', ap); return; }
      fd.append(el.name, el.value);
    });
    const w = widgets.get(form);
    if (w !== undefined && window.grecaptcha) fd.append('g-recaptcha-response', grecaptcha.getResponse(w));
    const label = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      const res = await fetch(GF_BASE + '/forms/' + id + '/submissions', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.is_valid) {
        const msg = data.confirmation_message || 'Thanks — we have received your message.';
        if (data.confirmation_type === 'redirect' && data.confirmation_redirect) { location.href = data.confirmation_redirect; return; }
        form.innerHTML = '<div class="oze-done"><p class="oze-done-title">Sent</p><div>' + msg + '</div></div>';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        showErrors(form, data.validation_messages);
        if (!data.validation_messages || !Object.keys(data.validation_messages).length) setStatus(form, data.message || 'Please check the form and try again.', 'error');
        if (w !== undefined && window.grecaptcha) grecaptcha.reset(w);
      }
    } catch (e) {
      setStatus(form, 'We couldn\'t send this right now. Please email <a href="mailto:info@ozekarts.com.au">info@ozekarts.com.au</a>.', 'error');
    } finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
  }
  function wire(form) {
    if (form.__oze) return; form.__oze = true;
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(form); });
    form.addEventListener('change', () => applyConditions(form));
    form.addEventListener('input', () => applyConditions(form));
    applyConditions(form);
  }
  function renderCaptcha(form) {
    const slot = form.querySelector('.g-recaptcha');
    if (!slot || widgets.has(form) || !window.grecaptcha || !grecaptcha.render) return;
    try { widgets.set(form, grecaptcha.render(slot, { sitekey: RECAPTCHA_SITE_KEY, theme: slot.dataset.theme || 'dark' })); } catch (e) {}
  }
  function scan(root) {
    q(root, 'form[data-gf]').forEach((f) => { wire(f); renderCaptcha(f); });
    q(root, '*').forEach((el) => { if (el.shadowRoot) scan(el.shadowRoot); });
  }
  const needCaptcha = () => document.querySelector('form[data-gf] .g-recaptcha') || Array.from(document.querySelectorAll('dc-import')).some((d) => d.shadowRoot && d.shadowRoot.querySelector('form[data-gf] .g-recaptcha'));
  window.ozeRecaptchaReady = () => scan(document);
  // reCAPTCHA (~350 KB of script) is only fetched once a captcha form is near the viewport or the user touches it.
  let captchaArmed = false;
  function injectCaptchaApi() {
    if (document.getElementById('oze-recaptcha')) return;
    const s = document.createElement('script'); s.id = 'oze-recaptcha'; s.async = true; s.defer = true;
    s.src = 'https://www.google.com/recaptcha/api.js?onload=ozeRecaptchaReady&render=explicit'; document.head.appendChild(s);
  }
  function loadCaptchaApi() {
    if (captchaArmed || document.getElementById('oze-recaptcha') || !needCaptchaLater()) return;
    captchaArmed = true;
    const forms = []; (function collect(root) { q(root, 'form[data-gf]').forEach((f) => { if (f.querySelector('.g-recaptcha')) forms.push(f); }); q(root, '*').forEach((el) => { if (el.shadowRoot) collect(el.shadowRoot); }); })(document);
    if (!('IntersectionObserver' in window)) return injectCaptchaApi();
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { injectCaptchaApi(); io.disconnect(); } }, { rootMargin: '600px 0px' });
    forms.forEach((f) => { io.observe(f); f.addEventListener('focusin', () => { injectCaptchaApi(); io.disconnect(); }, { once: true }); });
  }
  function boot() { scan(document); loadCaptchaApi(); }
  function needCaptchaLater() { try { return !!needCaptcha(); } catch (e) { return false; } }
  // The page renders its components right after dc-runtime mounts; rescan for a while so late forms get wired
  // and the reCAPTCHA API is loaded as soon as a captcha slot appears.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let tries = 0; const t = setInterval(() => { scan(document); loadCaptchaApi(); if (++tries > 40) clearInterval(t); }, 250);
  window.OZE_FORMS = { scan, GF_BASE };
})();
