/* Reuse the existing Apps Script via native POST. A cross-origin navigation
   shows its real response; an opaque fetch cannot confirm that a row was saved. */
(() => {
  const form = document.querySelector('#signup-form');
  if (!form) return;
  const status = form.querySelector('#form-status');
  const button = form.querySelector('[type="submit"]');
  let lastSubmission = 0;
  let cooldown;

  form.addEventListener('submit', event => {
    if (Date.now() - lastSubmission < 4000) {
      event.preventDefault();
      return;
    }
    // Native required/email validation runs before this event. Leave submission
    // and target=_blank to the browser, with no duplicate fetch or fake success.
    lastSubmission = Date.now();
    status.hidden = false;
    status.textContent = 'Comprueba la confirmación en la pestaña que se abrió. Si la respuesta dice «success», JET recibió tu registro; si muestra un error, conserva tus datos aquí y vuelve a intentarlo.';
    button.disabled = true;
    clearTimeout(cooldown);
    cooldown = setTimeout(() => { button.disabled = false; }, 4000);
    // Keep the entered values until the person has checked the actual receipt.
  });
})();
