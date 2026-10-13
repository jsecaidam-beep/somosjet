const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const directory = path.join(__dirname,'..');
const source = fs.readFileSync(path.join(directory,'territory.js'),'utf8');
const geography = JSON.parse(fs.readFileSync(path.join(directory,'assets','guatemala-departments.json'),'utf8'));
const official = ['Petén','Chiquimula','Jalapa','Izabal','Huehuetenango','Suchitepéquez','Retalhuleu','Sololá','Sacatepéquez','Guatemala','Jutiapa','El Progreso','Quetzaltenango'];

class Element {
  constructor() {
    this.children=[];this.attributes={};this.dataset={};this.listeners={};this.textContent='';this.value='';this.hidden=false;
    this.styles={};this.style={setProperty:(key,value) => this.styles[key]=value};
    this.classes=new Set();this.classList={toggle:(name,on) => {if(on)this.classes.add(name);else this.classes.delete(name);}};
  }
  setAttribute(key,value) {this.attributes[key]=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,char)=>char.toUpperCase())]=String(value);}
  append(...nodes) {this.children.push(...nodes);}
  replaceChildren(...nodes) {this.children=nodes;}
  addEventListener(type,callback) {(this.listeners[type] ||= []).push(callback);}
  fire(type,event={}) {for(const callback of this.listeners[type]||[])callback(event);}
  focus() {this.focused=true;this.fire('focus');}
}

async function boot() {
  const root=new Element();const map=new Element();const select=new Element();const name=new Element();const message=new Element();const error=new Element();
  const elements={'#territory-map':map,'#territory-select':select,'#territory-department-name':name,'#territory-presence-message':message,'#territory-map-error':error};
  const regions=() => map.children.flatMap(group=>group.children);
  root.querySelector=selector => elements[selector] || regions().find(region=>region.dataset.department===selector.match(/^\[data-department="(.+)"\]$/)?.[1]);
  root.querySelectorAll=selector => selector==='[data-department]' ? regions() : [];
  const requests=[];const events=[];
  const sandbox={
    window:{dispatchEvent:event=>events.push(event.type)},Event,
    document:{readyState:'complete',querySelector:selector=>selector==='#jet-territory' ? root : null,createElement:()=>new Element(),createElementNS:()=>new Element()},
    fetch:async url => {requests.push(url);return {ok:true,json:async()=>geography};}
  };
  vm.runInNewContext(source,sandbox,{filename:'territory.js'});
  await new Promise(resolve=>setImmediate(resolve));
  const api=sandbox.window.JETTerritory;
  const snapshot=()=>JSON.parse(JSON.stringify(api.getSnapshot()));
  return {api,snapshot,regions:regions(),select,name,message,events,requests};
}

test('official presence is exactly the supplied departments, with no counts',async()=> {
  const env=await boot();
  assert.deepEqual(env.snapshot(),{presence:official,selected:'Petén'});
  assert.deepEqual(Object.keys(env.api).sort(),['getSnapshot','highlightDepartment']);
  assert.equal(env.api.setData,undefined);
  assert.equal(env.api.addConfirmed,undefined);
  assert.equal(env.api.prepareLiveData,undefined);
  assert.equal(env.events.filter(type=>type==='jet:territory-ready').length,1);
});

test('all department geometries are interactive; only official regions are fuchsia',async()=> {
  const env=await boot();
  assert.equal(env.regions.length,22);
  const marked=env.regions.filter(region=>region.dataset.presence==='true');
  assert.deepEqual(marked.map(region=>region.dataset.department).sort(),official.slice().sort());
  for(const region of env.regions) {
    assert.equal(region.attributes.role,'button');
    assert.equal(region.attributes.tabindex,'0');
    assert.equal(/participaciones|participantes|[0-9]/i.test(region.attributes['aria-label']),false);
  }
  assert.deepEqual(env.requests,['assets/guatemala-departments.json']);
});

test('click, hover, keyboard and list expose only the territory and presence message',async()=> {
  const env=await boot();
  const chiquimula=env.regions.find(region=>region.dataset.department==='Chiquimula');
  chiquimula.fire('click');assert.equal(env.name.textContent,'Chiquimula');assert.equal(env.message.textContent,'JET tiene presencia aquí');
  const escuintla=env.regions.find(region=>region.dataset.department==='Escuintla');
  escuintla.fire('pointerenter');assert.equal(env.name.textContent,'Escuintla');assert.equal(env.message.textContent,'Sigamos conectando territorios');
  let prevented=false;
  chiquimula.fire('keydown',{key:'Enter',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(env.snapshot().selected,'Chiquimula');
  env.select.value='Sololá';env.select.fire('change');assert.equal(env.name.textContent,'Sololá');
  assert.deepEqual(env.snapshot().presence,official);
});

test('confirmation highlights official regions and recognizes place aliases',async()=> {
  const env=await boot();
  assert.equal(env.api.highlightDepartment('Puerto Barrios'),true);
  assert.equal(env.snapshot().selected,'Izabal');
  const izabal=env.regions.find(region=>region.dataset.department==='Izabal');
  assert.equal(izabal.focused,true);assert.equal(izabal.classes.has('is-highlighted'),true);
  assert.equal(env.api.highlightDepartment('Reu'),true);assert.equal(env.snapshot().selected,'Retalhuleu');
  assert.equal(env.api.highlightDepartment('Peten'),true);assert.equal(env.snapshot().selected,'Petén');
  assert.equal(env.api.highlightDepartment('Ciudad de Guatemala'),true);assert.equal(env.snapshot().selected,'Guatemala');
});

test('individual confirmations cannot expand official presence',async()=> {
  const env=await boot();const before=env.snapshot();
  for(const department of ['Escuintla','Alta Verapaz','Narnia','',undefined]) {
    assert.equal(env.api.highlightDepartment(department),false);
    assert.deepEqual(env.snapshot(),before);
  }
  const snapshot=env.api.getSnapshot();snapshot.presence.push('Escuintla');snapshot.selected='Narnia';
  assert.deepEqual(env.snapshot(),before);
});

test('fragment has no participant quantities, demo controls or category details',()=> {
  const html=fs.readFileSync(path.join(directory,'territory-section.html'),'utf8');
  for(const removed of ['territory-total','territory-active','territory-interests','territory-mode','data-territory-mode','Vista ilustrativa','Registros reales','participaciones','participantes']) assert.equal(html.includes(removed),false,removed);
  assert.match(html,/Presencia de JET/);assert.match(html,/sin datos individuales/);
  const css=fs.readFileSync(path.join(directory,'territory.css'),'utf8');
  assert.match(css,/\[data-presence="true"\]\{fill:var\(--pink\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\).*animation:none/s);
});
