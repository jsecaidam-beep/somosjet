'use strict';

// Browser-independent tests with isolated DOM, clock, POST and JSONP mocks.
// All network calls are mocked; this suite cannot add a spreadsheet row.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../form.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(__dirname, '../territory.js'), 'utf8');

function element() {
  const classes = new Set();
  return {
    hidden:false, disabled:false, textContent:'', attrs:{}, listeners:{}, children:[],
    style:{values:{}, setProperty(key, value) { this.values[key] = value; }},
    classList:{
      add:key => classes.add(key), remove:key => classes.delete(key), contains:key => classes.has(key),
      toggle(key, value) { if (value) classes.add(key); else classes.delete(key); }
    },
    setAttribute(key, value) { this.attrs[key] = value; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    remove() { this.removed = true; },
    replaceChildren() { this.children = []; },
    appendChild(child) { this.children.push(child); },
    append(...children) { this.children.push(...children); },
    focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; }
  };
}

function fixture(responses, options = {}) {
  let clock = 0;
  let context;
  const posts = [], queries = [], updates = [], prepared = [], documentListeners = {}, windowListeners = {};
  const values = {
    name:'Persona de prueba', email:'prueba@example.test', location:'Antigua Guatemala',
    department:'Sacatepéquez', interest:'Quiero ser parte de JET', consent:'yes', message:'', website:''
  };
  const form = element(), fields = element(), status = element(), success = element();
  const celebration = element(), again = element(), button = element(), label = element(), first = element(), title = element();
  form.action = 'https://script.google.com/macros/s/test/exec';
  form.reportValidity = () => options.valid !== false;
  form.querySelector = selector => selector === '[type="submit"]' ? button
    : selector === '.jet-submit-label' ? label : selector === 'input[name="name"]' ? first : null;
  form.reset = () => { Object.keys(values).forEach(key => { values[key] = ''; }); };
  fields.querySelectorAll = () => [first];
  success.hidden = true;
  label.textContent = 'Enviar mi energía';
  success.querySelector = () => title;
  const nodes = {
    '#signup-form':form, '#signup-fields':fields, '#form-status':status, '#form-success':success,
    '#signup-celebration':celebration, '#signup-again':again, '#jet-submit-label':label
  };
  const document = {
    baseURI:'https://somosjet.me/', querySelector:selector => nodes[selector] || null,
    addEventListener(name, callback) { documentListeners[name] = callback; },
    createElement:() => element(), createElementNS:() => element(),
    head:{appendChild(script) {
      const url = new URL(script.src);
      queries.push(url);
      const callback = url.searchParams.get('callback');
      queueMicrotask(() => {
        const action = url.searchParams.get('action');
        const response = action === 'territories'
          ? options.bootstrap || {protocol:'jet-v2', result:'success', stats:{mode:'live', territories:options.stats || []}}
          : responses.shift() || options.defaultStatus || {protocol:'jet-v2', result:'pending'};
        if (response.__timeout) return;
        if (response.__networkError) { script.onerror(); return; }
        const reply = {...response};
        if (action === 'status' && reply.protocol === 'jet-v2' && !Object.hasOwn(reply, 'requestId')) {
          reply.requestId = url.searchParams.get('requestId');
        }
        context.window[callback](reply);
      });
    }}
  };
  const timers = new Map();
  let nextTimer = 1;
  const schedule = (callback, ms) => {
    const id = nextTimer++;
    // Callback cleanup is immaterial to these short-lived isolated fixtures.
    if (ms >= 60000) return id;
    timers.set(id, setTimeout(() => { timers.delete(id); clock += ms; callback(); }, ms >= 7000 ? 2 : 0));
    return id;
  };
  const cancel = id => { clearTimeout(timers.get(id)); timers.delete(id); };
  context = {
    document,
    window:{
      matchMedia:() => ({matches:options.reducedMotion !== false}),
      addEventListener(name, callback) { windowListeners[name] = callback; },
      dispatchEvent(event) { if (windowListeners[event.type]) windowListeners[event.type](event); return true; }
    },
    crypto:webcrypto, URL, URLSearchParams, AbortController,
    Event:class { constructor(type) { this.type = type; } },
    FormData:class {
      constructor() { this.rows = Object.entries(values); }
      [Symbol.iterator]() { return this.rows[Symbol.iterator](); }
    },
    Date:class extends Date { static now() { return clock; } },
    setTimeout:schedule, clearTimeout:cancel,
    fetch:async (_url, request) => {
      assert.equal(request.method, 'POST');
      assert.equal(request.mode, 'no-cors');
      assert.equal(request.credentials, 'omit');
      posts.push(new URLSearchParams(request.body));
      if (options.fetchError) throw new Error('network');
      return {type:'opaque', status:0};
    }, console
  };
  vm.createContext(context);
  // Exercise the actual map state API. No map DOM is supplied, so its optional
  // visual initialization exits without any geometry fetch or browser work.
  vm.runInContext(mapSource, context, {filename:'territory.js'});
  const territory = context.window.JETTerritory;
  const wrapMap = () => ({
    ...territory,
    setData(data) { updates.push(data); return territory.setData(data); },
    prepareLiveData(data) { prepared.push(data); return territory.prepareLiveData(data); }
  });
  context.window.JETTerritory = options.lateMap ? undefined : wrapMap();
  vm.runInContext(source, context, {filename:'form.js'});
  let prevented = 0;
  return {
    submit:() => form.listeners.submit({preventDefault() { prevented += 1; }}),
    values, posts, queries, updates, prepared, form, fields, status, success, celebration, again, button, title, first,
    prevented:() => prevented,
    snapshot:() => JSON.parse(JSON.stringify(territory.getSnapshot())),
    showMode:mode => territory.showMode(mode),
    readyMap() { context.window.JETTerritory = wrapMap(); windowListeners['jet:territory-ready'](); },
    clear() { timers.forEach(clearTimeout); timers.clear(); }
  };
}

const total = snapshot => snapshot.territories.reduce((sum, row) => sum + row.total, 0);
const receipt = () => ({
  protocol:'jet-v2', result:'success', department:'Petén', interest:'Quiero ser parte de JET',
  stats:{mode:'live', territories:[{department:'Petén', total:1, interests:{member:1}}]}
});
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

(async () => {
  const f = fixture([{protocol:'jet-v2', result:'pending'}, receipt()]);
  await f.submit();
  assert.equal(f.success.hidden, false);
  assert.equal(f.fields.hidden, true);
  assert.equal(f.success.focused, true);
  assert.equal(f.title.textContent, 'Gracias por enviar tu energía.');
  assert.equal(f.updates.length, 1);
  assert.equal(f.snapshot().mode, 'live');
  assert.equal(total(f.snapshot()), 1, 'success replaces the 18 demo dots rather than adding to them');
  assert.equal(f.form.attrs['aria-busy'], 'false');
  assert.equal(f.posts[0].get('department'), 'Sacatepéquez');
  assert.equal(f.prevented(), 1, 'native submission/navigation is prevented');
  for (const url of f.queries) for (const key of url.searchParams.keys()) {
    assert(['action','requestId','callback','_'].includes(key), 'JSONP URL contains only receipt/control parameters');
  }
  assert(!f.queries.some(url => url.href.includes('prueba') || url.href.includes('Sacate')));
  assert.equal(f.celebration.children.length, 0, 'reduced-motion avoids transient sparkle animation');
  f.again.listeners.click();
  assert.equal(f.fields.hidden, false);
  assert.equal(f.success.hidden, true);
  assert.equal(f.first.focused, true);
  f.clear();

  const retry = fixture([{protocol:'jet-v2', result:'error'}, receipt()]);
  await retry.submit();
  assert.equal(retry.success.hidden, true);
  assert.equal(retry.values.email, 'prueba@example.test');
  assert.equal(retry.status.attrs.role, 'alert');
  assert.equal(retry.updates.length, 0);
  assert.equal(total(retry.snapshot()), 18);
  await retry.submit();
  assert.equal(retry.posts[0].get('requestId'), retry.posts[1].get('requestId'), 'server error retry reuses the same UUID');
  assert.equal(retry.success.hidden, false);
  retry.clear();

  const changed = fixture([{protocol:'jet-v2', result:'error'}, receipt()]);
  await changed.submit();
  changed.values.department = 'Petén';
  await changed.submit();
  assert.notEqual(changed.posts[0].get('requestId'), changed.posts[1].get('requestId'), 'changed payload gets its own UUID');
  changed.clear();

  const wrong = fixture([{protocol:'legacy', result:'success'}]);
  await wrong.submit();
  assert.equal(wrong.success.hidden, true);
  assert.match(wrong.status.textContent, /actualización/);
  assert.equal(wrong.values.email, 'prueba@example.test');
  assert.equal(wrong.updates.length, 0);
  wrong.clear();

  const pendingResponses = [];
  const pending = fixture(pendingResponses);
  await pending.submit();
  assert.equal(pending.success.hidden, true, 'opaque POST with only pending receipts cannot show success');
  assert.equal(pending.updates.length, 0);
  assert.match(pending.status.textContent, /Todavía no pudimos confirmar/);
  pendingResponses.push(receipt());
  await pending.submit();
  assert.equal(pending.posts[0].get('requestId'), pending.posts[1].get('requestId'), 'pending timeout retry reuses the UUID');
  assert.equal(pending.success.hidden, false);
  pending.clear();

  const timeoutResponses = [];
  const timeout = fixture(timeoutResponses, {defaultStatus:{__timeout:true}});
  await timeout.submit();
  assert.equal(timeout.success.hidden, true);
  assert.equal(timeout.values.email, 'prueba@example.test');
  assert.match(timeout.status.textContent, /Todavía no pudimos confirmar/);
  assert.equal(timeout.button.disabled, false);
  assert.equal(timeout.updates.length, 0);
  assert.equal(timeout.snapshot().mode, 'demo');
  timeoutResponses.push(receipt());
  await timeout.submit();
  assert.equal(timeout.posts[0].get('requestId'), timeout.posts[1].get('requestId'), 'JSONP timeout retry reuses the UUID');
  assert.equal(timeout.success.hidden, false);
  timeout.clear();

  const network = fixture([{__networkError:true}, receipt()]);
  await network.submit();
  assert.equal(network.success.hidden, false, 'JSONP transport retry can recover the saved receipt');
  assert.equal(network.posts.length, 1, 'receipt polling does not repeat the POST');
  network.clear();

  const mismatched = fixture([{...receipt(), requestId:'another-registration'}]);
  await mismatched.submit();
  assert.equal(mismatched.success.hidden, true, 'a receipt belonging to another UUID cannot confirm this form');
  assert.equal(mismatched.updates.length, 0);
  mismatched.clear();

  const interrupted = fixture([receipt()], {fetchError:true});
  await interrupted.submit();
  assert.equal(interrupted.success.hidden, false, 'interrupted POST response is recovered only through its saved receipt');
  interrupted.clear();

  const live = fixture([], {stats:[{department:'Escuintla', total:2, interests:{member:1, donor:1}}]});
  await flush();
  assert.equal(live.prepared.length, 1, 'bootstrap prepares the real aggregate');
  assert.equal(live.updates.length, 0, 'bootstrap never switches the view through setData');
  assert.equal(live.snapshot().mode, 'demo');
  assert.equal(total(live.snapshot()), 18, 'bootstrap retains the illustrative 18 participations');
  assert.equal(live.showMode('live'), true);
  assert.equal(live.snapshot().mode, 'live');
  assert.equal(total(live.snapshot()), 2, 'real-data mode contains only the cached actual aggregate');
  assert.equal(live.showMode('demo'), true);
  assert.equal(total(live.snapshot()), 18, 'illustration remains available independently');
  live.clear();

  const empty = fixture([]);
  await flush();
  assert.equal(empty.prepared.length, 1, 'an empty valid live response is prepared too');
  assert.equal(empty.updates.length, 0);
  assert.equal(total(empty.snapshot()), 18);
  empty.showMode('live');
  assert.equal(total(empty.snapshot()), 0, 'empty real-data mode must not contain the demo dots');
  empty.clear();

  const late = fixture([], {lateMap:true, stats:[{department:'Petén', total:3, interests:{member:3}}]});
  await flush();
  assert.equal(late.prepared.length, 0);
  late.readyMap();
  assert.equal(late.prepared.length, 1, 'late initialization applies the queued bootstrap as prepared data');
  assert.equal(late.updates.length, 0);
  assert.equal(total(late.snapshot()), 18);
  late.showMode('live');
  assert.equal(total(late.snapshot()), 3);
  late.clear();

  const bootstrapFailure = fixture([receipt()], {bootstrap:{__networkError:true}});
  await bootstrapFailure.submit();
  assert.equal(bootstrapFailure.prepared.length, 0);
  assert.equal(bootstrapFailure.success.hidden, false, 'bootstrap failure does not block registrations');
  bootstrapFailure.clear();

  const double = fixture([{protocol:'jet-v2', result:'pending'}, receipt()]);
  const inProgress = double.submit();
  await double.submit();
  assert.equal(double.posts.length, 1, 'a second submit while busy cannot send another POST');
  await inProgress;
  double.clear();

  const sparkle = fixture([receipt()], {reducedMotion:false});
  await sparkle.submit();
  assert.equal(sparkle.celebration.children.length, 18);
  assert(sparkle.celebration.children.every(svg => svg.attrs['aria-hidden'] === 'true' && svg.children[0].attrs.href.includes('#icon-sparkles')));
  sparkle.clear();

  console.log('PASS signup client: saved receipts only; pending/error/legacy/mismatched/JSONP-timeout handling; same-ID retries; no PII in URLs; no native navigation; busy guard; accessible success/reset; SVG sparkles and reduced motion.');
  console.log('PASS map integration: bootstrap prepares live data while retaining 18 demo dots; demo/live remain separate; empty live data contains zero demo dots; late map initialization retains the correct mode; successful signup switches to the real aggregate.');
  console.log('No real requests or registrations were sent.');
})().catch(error => { console.error(error); process.exit(1); });
