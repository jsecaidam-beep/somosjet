'use strict';

// Conditional international fields are tested without browser automation or
// network access. The production form script runs with isolated DOM mocks.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../form.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function element() {
  const classes = new Set();
  return {
    value:'', required:false, disabled:false, hidden:false, textContent:'', attributes:{}, events:{},
    classList:{
      contains:name => classes.has(name), add:name => classes.add(name), remove:name => classes.delete(name),
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }
    },
    addEventListener(name, callback) { this.events[name] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    replaceChildren() {}, remove() {}, focus() { this.focused = true; }, scrollIntoView() {}
  };
}

function fixture(responses) {
  const controls = Object.fromEntries(['name','email','department','location','country','region','interest','consent','website'].map(name => [name, element()]));
  Object.assign(controls.name, {value:'Persona de prueba', required:true});
  Object.assign(controls.email, {value:'prueba@example.test', required:true});
  Object.assign(controls.department, {value:'Sacatepéquez', required:true});
  Object.assign(controls.interest, {value:'Quiero ser parte de JET', required:true});
  Object.assign(controls.consent, {value:'yes', required:true});
  controls.country.disabled = true;
  controls.region.disabled = true;
  const form = element(), fields = element(), international = element(), status = element();
  const success = element(), celebration = element(), again = element(), button = element(), label = element();
  const posts = [], queries = [], highlights = [], windowEvents = {}, timers = new Map();
  let nextTimer = 0;
  let context;
  form.action = 'https://script.google.com/macros/s/test/exec';
  form.querySelector = selector => selector === '[type="submit"]' ? button
    : selector === 'select[name="department"]' ? controls.department
    : selector === '.jet-submit-label' ? label
    : selector === 'input[name="name"]' ? controls.name : null;
  form.reportValidity = () => Object.values(controls).every(control => control.disabled || !control.required || control.value.trim() !== '');
  form.reset = () => {
    if (form.events.reset) form.events.reset();
    Object.values(controls).forEach(control => { control.value = ''; });
  };
  fields.querySelectorAll = () => Object.values(controls);
  international.querySelectorAll = () => [controls.country, controls.region];
  international.hidden = true;
  success.hidden = true;
  label.textContent = 'Enviar mi energía';
  const selectors = {
    '#signup-form':form, '#signup-fields':fields, '#jet-international-fields':international,
    '#form-status':status, '#form-success':success, '#signup-celebration':celebration,
    '#signup-again':again, '#jet-submit-label':label
  };
  const document = {
    baseURI:'https://somosjet.me/', querySelector:selector => selectors[selector] || null,
    addEventListener() {}, createElement:() => element(),
    head:{appendChild(script) {
      const url = new URL(script.src);
      queries.push(url);
      assert.equal(url.searchParams.get('action'), 'status');
      queueMicrotask(() => {
        const response = responses.shift() || {protocol:'jet-v2', result:'error'};
        context.window[url.searchParams.get('callback')]({...response, requestId:url.searchParams.get('requestId')});
      });
    }}
  };
  const schedule = (callback, delay) => {
    const id = ++nextTimer;
    if (delay >= 60000) return id;
    timers.set(id, setTimeout(callback, delay));
    return id;
  };
  const cancel = id => { clearTimeout(timers.get(id)); timers.delete(id); };
  context = {
    document, URL, URLSearchParams, AbortController, crypto:webcrypto, Date, queueMicrotask,
    setTimeout:schedule, clearTimeout:cancel,
    window:{
      matchMedia:() => ({matches:true}),
      addEventListener(name, callback) { windowEvents[name] = callback; },
      JETTerritory:{highlightDepartment:department => highlights.push(department)}
    },
    FormData:class {
      constructor() { this.rows = Object.entries(controls).filter(([,control]) => !control.disabled).map(([name,control]) => [name, control.value]); }
      [Symbol.iterator]() { return this.rows[Symbol.iterator](); }
    },
    fetch:async (_url, request) => { posts.push(new URLSearchParams(request.body)); return {type:'opaque', status:0}; }
  };
  vm.runInNewContext(source, context);
  return {
    controls, international, form, status, success, fields, posts, queries, highlights, again,
    choose(value) { controls.department.value = value; controls.department.events.change(); },
    submit:() => form.events.submit({preventDefault() {}}),
    pageshow:() => windowEvents.pageshow(),
    clear() { timers.forEach(clearTimeout); }
  };
}

(async () => {
  assert.match(html, /<option value="international">No soy de Guatemala<\/option>/);
  const group = html.match(/<div[^>]+id="jet-international-fields"[^>]*>/)[0];
  assert.match(group, /\bhidden\b/);
  for (const [id, name, autocomplete, max] of [['jet-country','country','country-name','100'],['jet-region','region','address-level1','150']]) {
    const input = html.match(new RegExp('<input[^>]+id="'+id+'"[^>]*>'))[0];
    assert.match(input, new RegExp('name="'+name+'"'));
    assert.match(input, new RegExp('autocomplete="'+autocomplete+'"'));
    assert.match(input, new RegExp('maxlength="'+max+'"'));
    assert.match(input, /type="text"/);
    assert.match(input, /\bdisabled\b/);
    assert.match(html, new RegExp('<label[^>]+for="'+id+'"'));
  }

  const toggled = fixture([{protocol:'jet-v2', result:'success', department:'Sacatepéquez'}]);
  assert.equal(toggled.international.hidden, true);
  assert.equal(toggled.controls.country.disabled, true);
  assert.equal(toggled.controls.region.required, false);
  toggled.choose('international');
  assert.equal(toggled.international.hidden, false);
  assert.equal(toggled.controls.country.disabled, false);
  assert.equal(toggled.controls.country.required, true);
  assert.equal(toggled.controls.region.required, true);
  await toggled.submit();
  assert.equal(toggled.posts.length, 0, 'missing required country and region block the POST');
  toggled.controls.country.value = 'México';
  await toggled.submit();
  assert.equal(toggled.posts.length, 0, 'missing required region still blocks the POST');
  toggled.controls.region.value = 'Chiapas';
  toggled.choose('Sacatepéquez');
  assert.equal(toggled.international.hidden, true);
  assert.equal(toggled.controls.country.disabled, true);
  assert.equal(toggled.controls.region.disabled, true);
  assert.equal(toggled.controls.country.required, false);
  assert.equal(toggled.controls.country.value, 'México', 'switching back to Guatemala retains the typed country');
  toggled.choose('international');
  assert.equal(toggled.controls.region.value, 'Chiapas', 'switching to international restores the typed region');
  toggled.choose('Sacatepéquez');
  await toggled.submit();
  assert.equal(toggled.posts.length, 1);
  assert.equal(toggled.posts[0].has('country'), false, 'a Guatemala POST excludes retained foreign country');
  assert.equal(toggled.posts[0].has('region'), false, 'a Guatemala POST excludes retained foreign region');
  toggled.clear();

  const abroad = fixture([{protocol:'jet-v2', result:'success', department:''}]);
  abroad.choose('international');
  abroad.controls.country.value = 'México';
  abroad.controls.region.value = 'Chiapas';
  const sending = abroad.submit();
  assert.equal(abroad.controls.country.disabled, true, 'in-flight data cannot be edited');
  assert.equal(abroad.controls.region.disabled, true);
  await sending;
  assert.equal(abroad.posts[0].get('department'), 'international');
  assert.equal(abroad.posts[0].get('country'), 'México');
  assert.equal(abroad.posts[0].get('region'), 'Chiapas');
  assert.equal(abroad.success.hidden, false);
  assert.equal(abroad.highlights.length, 0, 'international receipt never highlights a Guatemala department');
  for (const url of abroad.queries) {
    for (const key of url.searchParams.keys()) assert(['action','requestId','callback','_'].includes(key));
    assert(!decodeURIComponent(url.href).includes('Chiapas') && !decodeURIComponent(url.href).includes('México'));
  }
  abroad.again.events.click();
  await Promise.resolve();
  assert.equal(abroad.international.hidden, true);
  assert.equal(abroad.controls.country.disabled, true);
  assert.equal(abroad.controls.region.required, false);
  assert.equal(abroad.controls.country.value, '');
  assert.equal(abroad.controls.region.value, '');
  assert.equal(abroad.fields.hidden, false);
  abroad.clear();

  const retry = fixture([{protocol:'jet-v2', result:'error'},{protocol:'jet-v2', result:'success', department:''}]);
  retry.choose('international');
  retry.controls.country.value = 'México';
  retry.controls.region.value = 'Chiapas';
  await retry.submit();
  assert.equal(retry.success.hidden, true);
  assert.equal(retry.controls.country.value, 'México');
  assert.equal(retry.controls.region.disabled, false);
  assert.equal(retry.controls.region.required, true);
  await retry.submit();
  assert.equal(retry.posts[0].get('requestId'), retry.posts[1].get('requestId'), 'international retry reuses its UUID');
  retry.clear();

  const edited = fixture([{protocol:'jet-v2', result:'error'},{protocol:'jet-v2', result:'success', department:''}]);
  edited.choose('international');
  edited.controls.country.value = 'México';
  edited.controls.region.value = 'Chiapas';
  await edited.submit();
  edited.controls.region.value = 'Oaxaca';
  await edited.submit();
  assert.notEqual(edited.posts[0].get('requestId'), edited.posts[1].get('requestId'), 'editing the foreign territory creates a new attempt');
  edited.clear();

  const restored = fixture([]);
  restored.controls.department.value = 'international';
  restored.pageshow();
  assert.equal(restored.international.hidden, false, 'browser-restored territory selection synchronizes the conditional fields');
  assert.equal(restored.controls.country.required, true);
  restored.choose('Guatemala');
  assert.equal(restored.controls.country.disabled, true);
  restored.clear();

  console.log('PASS international signup: required country/region only abroad; values survive territory changes; Guatemala POST excludes foreign fields; international POST contains country/region without putting them in URLs; no map highlight abroad; reset and browser restoration synchronize the UI; error retry keeps the UUID, changed data gets a new one.');
  console.log('No real requests or registrations were sent.');
})().catch(error => { console.error(error); process.exit(1); });
