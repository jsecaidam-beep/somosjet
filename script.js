const form = document.querySelector('#signup-form');
const status = document.querySelector('#form-status');
const sheetUrl = form.dataset.sheetUrl.trim();

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  });
}, { threshold: 0.12 });

const animatedText = document.querySelectorAll('main h1, main h2, main h3, main p, main .impact-card, main .button, main .text-link, main label');
const animatedBlocks = [...document.querySelectorAll('.reveal'), ...animatedText];

animatedBlocks.forEach((element, index) => {
  if (!element.classList.contains('reveal')) {
    element.classList.add('text-reveal');
    element.style.setProperty('--reveal-delay', `${(index % 5) * 55}ms`);
  }
  observer.observe(element);
});

const valuesStage = document.querySelector('.values-stage');
const valuesNetwork = document.querySelector('.values-network g');
const valueNodes = [...document.querySelectorAll('.draggable-value')];

const redrawNetwork = () => {
  if (!valuesStage || !valuesNetwork) return;
  const width = valuesStage.clientWidth;
  const height = valuesStage.clientHeight;
  const center = { x: width / 2, y: height / 2 };
  valuesNetwork.parentElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
  valuesNetwork.replaceChildren();

  valueNodes.forEach((node) => {
    const x = node.offsetLeft + node.offsetWidth / 2;
    const y = node.offsetTop + node.offsetHeight / 2;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', center.x);
    line.setAttribute('y1', center.y);
    line.setAttribute('x2', x);
    line.setAttribute('y2', y);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    dot.setAttribute('r', '5');
    valuesNetwork.append(line, dot);
  });
};

valueNodes.forEach((node) => {
  node.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const left = node.offsetLeft;
    const top = node.offsetTop;
    node.classList.add('dragging');
    node.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      const maxLeft = valuesStage.clientWidth - node.offsetWidth - 10;
      const maxTop = valuesStage.clientHeight - node.offsetHeight - 10;
      node.style.left = `${Math.max(10, Math.min(maxLeft, left + moveEvent.clientX - startX))}px`;
      node.style.top = `${Math.max(10, Math.min(maxTop, top + moveEvent.clientY - startY))}px`;
      node.style.right = 'auto';
      node.style.bottom = 'auto';
      redrawNetwork();
    };

    const stop = () => {
      node.classList.remove('dragging');
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', stop);
      node.removeEventListener('pointercancel', stop);
    };

    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', stop);
    node.addEventListener('pointercancel', stop);
  });
});

window.addEventListener('resize', redrawNetwork);
redrawNetwork();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  const data = new URLSearchParams(new FormData(form));

  if (!sheetUrl) {
    status.textContent = 'El formulario ya está listo. Falta vincular el enlace de Google Sheets para recibir registros reales.';
    return;
  }

  button.disabled = true;
  button.innerHTML = 'Enviando energía...';
  try {
    await fetch(sheetUrl, { method: 'POST', mode: 'no-cors', body: data });
    status.textContent = '¡Listo! Gracias por sumarte al movimiento JET.';
    form.reset();
  } catch {
    status.textContent = 'No pudimos enviar tus datos. Inténtalo otra vez en un momento.';
  } finally {
    button.disabled = false;
    button.innerHTML = 'Enviar mi energía <span>→</span>';
  }
});
