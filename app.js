const menuButton = document.querySelector('.menu-button');
const mobileMenu = document.querySelector('#menu-movil');
menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.setAttribute('aria-label', expanded ? 'Abrir menú' : 'Cerrar menú');
  mobileMenu.hidden = expanded;
});
mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  mobileMenu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Abrir menú');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileMenu.hidden) {
    mobileMenu.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menú');
    menuButton.focus();
  }
});
const details = [...document.querySelectorAll('.movement-row')];
details.forEach(detail => detail.addEventListener('toggle', () => {
  if (detail.open) details.forEach(other => { if (other !== detail) other.open = false; });
}));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const revealTargets = document.querySelectorAll('.hero-copy, .section-top, .about-grid, .movement-heading, .movement-row, .next-heading, .values-collage, .gallery-card, .jet-form, .join-grid>div:first-child');
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); } });
  }, {threshold: .06});
  revealTargets.forEach((element, index) => { element.classList.add('reveal'); element.style.setProperty('--reveal-delay', (index % 3) * 65 + 'ms'); revealObserver.observe(element); });
}

const stage = document.querySelector('#glass-stage');
const canvas = document.querySelector('#art-canvas');
const context = canvas.getContext('2d');
let variation = 0;
let glass = null;
let heroVisible = true;
let phase = 0;
let renderedFrames = 0;
let animationId = 0;
let lastFrame = 0;
function roundedRect(x,y,w,h,r) { context.beginPath(); context.roundRect(x,y,w,h,r); }
function fitCanvas() {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(stage.clientWidth * scale);
  canvas.height = Math.round(stage.clientHeight * scale);
  drawArt();
}
function drawArt() {
  const width = stage.clientWidth, height = stage.clientHeight;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  context.setTransform(scale,0,0,scale,0,0);
  context.clearRect(0,0,width,height);
  const sx = width / 520, sy = height / 570;
  context.save(); context.scale(sx,sy);
  const centerX=275, centerY=269;
  context.save();context.translate(centerX,centerY);context.rotate(-.24 + variation*.3 + phase*.045);
  context.strokeStyle = '#ffffffa0';context.lineWidth = 1.5;context.beginPath();context.ellipse(0,0,225,202,0,0,Math.PI*2);context.stroke();
  context.rotate(.7 - phase*.11);context.strokeStyle='#40388d35';context.beginPath();context.ellipse(0,0,226,179,0,0,Math.PI*2);context.stroke();context.restore();
  context.save();context.translate(290 + Math.sin(phase*.55)*7,255 + Math.sin(phase*.75)*12);context.rotate(-.23 + variation*.14 + Math.sin(phase*.5)*.09);
  context.shadowColor='#a5506470';context.shadowBlur=26;context.shadowOffsetY=18;
  const ball=context.createRadialGradient(-55,-65,5,0,0,178);ball.addColorStop(0,'#ffeebe');ball.addColorStop(.38,variation%2?'#89c2ff':'#ffcc25');ball.addColorStop(.85,variation%2?'#398bf2':'#f7aa00');ball.addColorStop(1,variation%2?'#2465c0':'#df7200');
  context.fillStyle=ball;context.beginPath();context.arc(0,0,168,0,Math.PI*2);context.fill();context.shadowBlur=0;context.shadowOffsetY=0;
  context.strokeStyle='#ffffff50';context.lineWidth=1;context.beginPath();context.arc(0,0,164,0,Math.PI*2);context.stroke();context.restore();
  context.save();context.translate(387 + Math.sin(phase*.62)*7,428 + Math.cos(phase*.78)*15);context.rotate(.45+variation*.25+Math.sin(phase*.7)*.25);context.shadowColor='#40388d30';context.shadowBlur=15;context.shadowOffsetY=12;
  context.fillStyle='#40388d';context.beginPath();context.moveTo(-50,-36);context.lineTo(47,-36);context.lineTo(61,45);context.lineTo(-34,45);context.closePath();context.fill();
  context.shadowBlur=0;context.shadowOffsetY=0;context.fillStyle='#645bb8';context.beginPath();context.moveTo(-50,-36);context.lineTo(-35,-52);context.lineTo(61,-52);context.lineTo(47,-36);context.closePath();context.fill();
  context.fillStyle='#2c266b';context.beginPath();context.moveTo(47,-36);context.lineTo(61,-52);context.lineTo(76,29);context.lineTo(61,45);context.closePath();context.fill();context.restore();
  context.save();context.translate(116,439 + Math.sin(phase*.8 + 1)*9);context.rotate(-.2 + phase*.085);context.fillStyle='#fff8ed';
  for(let i=0;i<8;i++){context.rotate(Math.PI/4);roundedRect(-12,-60,24,87,12);context.fill();}context.restore();
  context.fillStyle='#f50064';context.beginPath();context.arc(428,55 + Math.sin(phase*.8)*7,7,0,Math.PI*2);context.fill();context.strokeStyle='#40388d';context.lineWidth=2;context.beginPath();context.arc(428,55 + Math.sin(phase*.8)*7,18,0,Math.PI*2);context.stroke();
  context.restore();
  canvas.dataset.animationFrame = String(++renderedFrames);
  glass?.markChanged(canvas);
}
fitCanvas();
const observer = new ResizeObserver(fitCanvas);
observer.observe(stage);
document.querySelector('#glass-orb').addEventListener('click', () => { variation++; drawArt(); });
async function initializeGlass() {
  if (!context || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.dataset.glassMode = 'css'; return;
  }
  try {
    await document.fonts.ready;
    const { LiquidGlass } = await import('./assets/liquidglass-1.0.3.js');
    const pieces = [...stage.querySelectorAll('.glass-piece')];
    // Keep the rasterized scene small: one canvas, two text wrappers, two glasses.
    glass = await LiquidGlass.init({ root: stage, glassElements: pieces });
    pieces.forEach(piece => piece.classList.add('is-webgl'));
    stage.dataset.glassMode = 'webgl';
    glass.markChanged();
  } catch(error) {
    stage.dataset.glassMode = 'css';
    console.warn('Liquid Glass: el estilo de vidrio CSS permanece disponible.', error.message);
  }
}
initializeGlass();
const sceneVisibility = new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }, {rootMargin:'100px'});
sceneVisibility.observe(stage);
function animateScene(time) {
  const interval = window.innerWidth < 600 ? 1000 / 24 : 1000 / 30;
  if (heroVisible && !document.hidden && !reducedMotion.matches && time - lastFrame >= interval) {
    phase += Math.min((time - lastFrame) / 1000, .08);
    lastFrame = time;
    drawArt();
  }
  animationId = requestAnimationFrame(animateScene);
}
animationId = requestAnimationFrame(animateScene);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) { phase = 0; drawArt(); }
});
window.addEventListener('pagehide', () => { cancelAnimationFrame(animationId); sceneVisibility.disconnect(); glass?.destroy(); observer.disconnect(); }, {once:true});
