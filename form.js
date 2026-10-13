/* A POST may be opaque across origins. Only the backend's separate receipt
   confirms a saved registration; transport completion never means success. */
(() => {
  'use strict';
  const form = document.querySelector('#signup-form');
  if (!form) return;
  const fields = document.querySelector('#signup-fields');
  const status = document.querySelector('#form-status');
  const success = document.querySelector('#form-success');
  const celebration = document.querySelector('#signup-celebration');
  const again = document.querySelector('#signup-again');
  const button = form.querySelector('[type="submit"]');
  const buttonLabel = document.querySelector('#jet-submit-label') || form.querySelector('.jet-submit-label');
  const initialLabel = buttonLabel ? buttonLabel.textContent : 'Enviar mi energía';
  const departmentField = form.querySelector('select[name="department"]');
  const internationalFields = document.querySelector('#jet-international-fields');
  const internationalControls = internationalFields ? Array.from(internationalFields.querySelectorAll('input')) : [];
  const endpoint = new URL(form.action, document.baseURI);
  let busy = false;
  let lastAttempt = null;
  let disabledFields = [];
  let glintTimer;
  let queuedDepartment = null;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function message(text, isError = false) {
    if (!status) return;
    status.hidden = false;
    status.textContent = text;
    status.setAttribute('role', isError ? 'alert' : 'status');
    status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    status.classList.toggle('is-error', isError);
  }

  function syncInternationalFields() {
    const international = !!departmentField && departmentField.value === 'international';
    if (internationalFields) internationalFields.hidden = !international;
    internationalControls.forEach(control => {
      // Disabling hidden controls removes them from native validation and POST.
      // Their current values stay in the form when the person changes territory.
      control.required = international;
      control.disabled = !international || busy;
    });
  }
  if (departmentField) departmentField.addEventListener('change', syncInternationalFields);
  form.addEventListener('reset', () => queueMicrotask(syncInternationalFields));
  window.addEventListener('pageshow', syncInternationalFields);
  syncInternationalFields();

  function setBusy(value, label) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    if (value) {
      disabledFields = Array.from((fields || form).querySelectorAll('input,select,textarea')).map(control => [control, control.disabled]);
      disabledFields.forEach(([control]) => { control.disabled = true; });
    } else {
      disabledFields.forEach(([control, wasDisabled]) => { control.disabled = wasDisabled; });
      disabledFields = [];
      syncInternationalFields();
    }
    if (button) button.disabled = value;
    if (buttonLabel) buttonLabel.textContent = value ? (label || 'Enviando tu energía…') : initialLabel;
    form.classList.toggle('is-submitting', value);
  }

  function highlightDepartment(department) {
    if (typeof department !== 'string' || !department.trim()) return;
    if (window.JETTerritory && typeof window.JETTerritory.highlightDepartment === 'function') {
      window.JETTerritory.highlightDepartment(department);
      queuedDepartment = null;
    } else queuedDepartment = department;
  }

  function applyQueuedHighlight() {
    if (queuedDepartment) highlightDepartment(queuedDepartment);
  }
  document.addEventListener('DOMContentLoaded', applyQueuedHighlight, {once:true});
  window.addEventListener('jet:territory-ready', applyQueuedHighlight);

  function requestJSONP(parameters, timeout = 7500) {
    return new Promise((resolve, reject) => {
      if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname)) {
        reject(new Error('endpoint'));
        return;
      }
      const callback = 'jet_' + crypto.randomUUID().replace(/-/g, '');
      const url = new URL(endpoint.href);
      url.search = '';
      Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set('callback', callback);
      url.searchParams.set('_', Date.now());
      const script = document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      let settled = false;
      let timer;
      function cleanup() {
        clearTimeout(timer);
        script.remove();
        // A timed-out response may already be downloading. Keep a temporary
        // harmless callback so it cannot mutate the page or throw on arrival.
        window[callback] = () => {};
        setTimeout(() => { delete window[callback]; }, 60000);
      }
      function finish(error, value) {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error); else resolve(value);
      }
      window[callback] = value => finish(null, value);
      script.onerror = () => finish(new Error('network'));
      script.src = url.href;
      timer = setTimeout(() => finish(new Error('timeout')), timeout);
      document.head.appendChild(script);
    });
  }

  async function confirmReceipt(requestId) {
    const deadline = Date.now() + 35000;
    let attempt = 0;
    while (Date.now() < deadline) {
      if (attempt) await wait(Math.min(500 + attempt * 350, 2500));
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      let response;
      try {
        response = await requestJSONP({action:'status', requestId}, Math.min(7500, remaining));
      } catch (_) {
        attempt += 1;
        continue;
      }
      if (!response || response.protocol !== 'jet-v2') throw new Error('protocol');
      if (response.requestId !== requestId) throw new Error('receipt');
      if (response.result === 'success') return response;
      if (response.result === 'error') throw new Error('rejected');
      if (response.result !== 'pending') throw new Error('protocol');
      message('Tu energía va en camino. Estamos confirmando tu registro…');
      attempt += 1;
    }
    throw new Error('pending');
  }

  function sparkle() {
    if (!celebration) return;
    clearTimeout(glintTimer);
    celebration.replaceChildren();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ns = 'http://www.w3.org/2000/svg';
    for (let index = 0; index < 18; index += 1) {
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('class', 'jet-icon signup-glint');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.style.setProperty('--glint-x', `${10 + Math.random() * 80}%`);
      svg.style.setProperty('--glint-y', `${15 + Math.random() * 65}%`);
      svg.style.setProperty('--glint-size', `${16 + Math.random() * 24}px`);
      svg.style.setProperty('--glint-delay', `${Math.random() * .65}s`);
      svg.style.setProperty('--glint-turn', `${Math.random() * 100 - 50}deg`);
      const use = document.createElementNS(ns, 'use');
      use.setAttribute('href', './assets/icons.svg#icon-sparkles');
      svg.appendChild(use);
      celebration.appendChild(svg);
    }
    glintTimer = setTimeout(() => celebration.replaceChildren(), 3000);
  }

  function showSuccess(receipt) {
    // Focus the person's chosen territory without changing JET's official
    // presence or publishing any registration data on the map.
    highlightDepartment(receipt.department);
    if (fields) fields.hidden = true;
    if (status) status.hidden = true;
    form.classList.add('is-success');
    if (success) {
      success.hidden = false;
      success.focus({preventScroll:true});
      success.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'nearest'});
    }
    sparkle();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || form.classList.contains('is-success')) return;
    syncInternationalFields();
    if (!form.reportValidity()) return;
    const body = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      if ((name === 'country' || name === 'region') && (!departmentField || departmentField.value !== 'international')) continue;
      if (typeof value === 'string' && name !== 'requestId') body.append(name, value);
    }
    body.set('website', body.get('website') || '');
    if (body.get('website')) {
      message('No pudimos enviar el formulario. Revisa tus datos y vuelve a intentarlo.', true);
      return;
    }
    const fingerprint = Array.from(body.entries()).sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
    const key = JSON.stringify(fingerprint);
    if (!lastAttempt || lastAttempt.key !== key) lastAttempt = {key, requestId:crypto.randomUUID()};
    const requestId = lastAttempt.requestId;
    body.set('requestId', requestId);
    setBusy(true);
    message('Enviando tu energía. Quédate aquí; confirmaremos tu registro en esta página.');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        await fetch(endpoint.href, {method:'POST', mode:'no-cors', credentials:'omit', redirect:'follow', body, signal:controller.signal});
      } catch (_) {
        // An interrupted response can still follow a successful write. Ask for
        // the saved receipt rather than assuming either success or failure.
      } finally { clearTimeout(timer); }
      if (buttonLabel) buttonLabel.textContent = 'Confirmando tu energía…';
      const receipt = await confirmReceipt(requestId);
      setBusy(false);
      showSuccess(receipt);
    } catch (error) {
      setBusy(false);
      if (error.message === 'protocol' || error.message === 'endpoint') {
        message('El servicio de registro está en actualización. Conservamos tus datos aquí; vuelve a intentar en unos minutos.', true);
      } else if (error.message === 'rejected') {
        message('No pudimos guardar tu registro. Revisa tus datos y vuelve a intentarlo.', true);
      } else {
        message('Todavía no pudimos confirmar tu registro. Tus datos siguen aquí. Puedes volver a enviar: revisaremos el mismo intento para evitar duplicarlo.', true);
      }
    }
  });

  if (again) again.addEventListener('click', () => {
    if (!form.classList.contains('is-success') || busy) return;
    form.reset();
    syncInternationalFields();
    lastAttempt = null;
    form.classList.remove('is-success');
    if (success) success.hidden = true;
    if (fields) fields.hidden = false;
    if (status) status.hidden = true;
    clearTimeout(glintTimer);
    if (celebration) celebration.replaceChildren();
    const first = form.querySelector('input[name="name"]');
    if (first) first.focus();
  });

})();
