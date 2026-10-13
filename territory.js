/* Official territorial presence, supplied by JET. No individual registration data. */
(() => {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DEPARTMENTS = ['Alta Verapaz','Baja Verapaz','Chimaltenango','Chiquimula','El Progreso','Escuintla','Guatemala','Huehuetenango','Izabal','Jalapa','Jutiapa','Petén','Quetzaltenango','Quiché','Retalhuleu','Sacatepéquez','San Marcos','Santa Rosa','Sololá','Suchitepéquez','Totonicapán','Zacapa'];
  const PRESENCE = Object.freeze(['Petén','Chiquimula','Jalapa','Izabal','Huehuetenango','Suchitepéquez','Retalhuleu','Sololá','Sacatepéquez','Guatemala','Jutiapa','El Progreso','Quetzaltenango']);
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const canonicalDepartment = value => {
    const normalized = normalize(value).replace(/^departamento de /,'');
    const aliases = {'ciudad de guatemala':'Guatemala','guatemala ciudad':'Guatemala','puerto barrios':'Izabal',reu:'Retalhuleu',xela:'Quetzaltenango',xelaju:'Quetzaltenango','antigua guatemala':'Sacatepéquez',antigua:'Sacatepéquez',sacatepeques:'Sacatepéquez',zacatepeques:'Sacatepéquez',zacatepequez:'Sacatepéquez'};
    return aliases[normalized] || DEPARTMENTS.find(name => normalize(name) === normalized) || null;
  };
  let selected = 'Petén';
  let highlighted = null;
  let root;
  let map;
  const selectDepartment = department => {
    const valid = canonicalDepartment(department);
    if (!valid) return false;
    selected = valid;
    renderSelection();
    return true;
  };
  const renderSelection = () => {
    if (!root) return;
    root.querySelector('#territory-select').value = selected;
    root.querySelector('#territory-department-name').textContent = selected;
    root.querySelector('#territory-presence-message').textContent = PRESENCE.includes(selected) ? 'JET tiene presencia aquí' : 'Sigamos conectando territorios';
    for (const node of root.querySelectorAll('[data-department]')) {
      node.setAttribute('aria-pressed',String(node.dataset.department === selected));
      node.classList.toggle('is-highlighted',node.dataset.department === highlighted);
    }
  };
  const highlightDepartment = department => {
    const valid = canonicalDepartment(department);
    if (!valid || !PRESENCE.includes(valid)) return false;
    highlighted = valid;
    selectDepartment(valid);
    const region = root?.querySelector(`[data-department="${valid}"]`);
    if (region) region.focus({preventScroll:true});
    return true;
  };
  window.JETTerritory = Object.freeze({highlightDepartment,getSnapshot:() => ({presence:[...PRESENCE],selected})});
  const svgNode = (tag,attributes = {}) => {
    const node = document.createElementNS(SVG_NS,tag);
    for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
    return node;
  };
  const init = async () => {
    root = document.querySelector('#jet-territory');
    if (!root) return;
    map = root.querySelector('#territory-map');
    const select = root.querySelector('#territory-select');
    select.replaceChildren(...DEPARTMENTS.map(name => {
      const option = document.createElement('option');option.value=name;option.textContent=name;return option;
    }));
    select.addEventListener('change',() => selectDepartment(select.value));
    renderSelection();
    try {
      const response = await fetch('assets/guatemala-departments.json');
      if (!response.ok) throw new Error('Local map unavailable');
      const data = await response.json();
      if (!Array.isArray(data.departments) || data.departments.length !== DEPARTMENTS.length) throw new Error('Invalid departmental geometry');
      map.setAttribute('viewBox',data.viewBox.join(' '));
      const areas = svgNode('g',{class:'territory-areas'});
      for (const feature of data.departments) {
        const present = PRESENCE.includes(feature.name);
        const path = svgNode('path',{class:'territory-department',d:feature.path,'fill-rule':'evenodd','data-department':feature.name,'data-presence':present,role:'button',tabindex:0,'aria-label':`${feature.name}. ${present ? 'JET tiene presencia aquí' : 'Sigamos conectando territorios'}`,'aria-pressed':feature.name === selected});
        if (present) path.style.setProperty('--territory-delay',`${PRESENCE.indexOf(feature.name)*45}ms`);
        path.addEventListener('click',() => selectDepartment(feature.name));
        path.addEventListener('pointerenter',() => selectDepartment(feature.name));
        path.addEventListener('focus',() => selectDepartment(feature.name));
        path.addEventListener('keydown',event => {
          if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();selectDepartment(feature.name);}
        });
        areas.append(path);
      }
      map.append(areas);
      renderSelection();
      if (highlighted) root.querySelector(`[data-department="${highlighted}"]`)?.focus({preventScroll:true});
    } catch (error) {
      root.querySelector('#territory-map-error').hidden = false;
      map.hidden = true;
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.dispatchEvent(new Event('jet:territory-ready'));
})();
