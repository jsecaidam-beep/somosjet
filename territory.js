/* Department-level visualization. Demo values never mix with confirmed data. */
(() => {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DEPARTMENTS = ['Alta Verapaz','Baja Verapaz','Chimaltenango','Chiquimula','El Progreso','Escuintla','Guatemala','Huehuetenango','Izabal','Jalapa','Jutiapa','Petén','Quetzaltenango','Quiché','Retalhuleu','Sacatepéquez','San Marcos','Santa Rosa','Sololá','Suchitepéquez','Totonicapán','Zacapa'];
  const INTERESTS = {
    member: {label:'Ser parte de JET',icon:'sparkles'},
    organization: {label:'Organizaciones',icon:'users'},
    donor: {label:'Apoyar como donante',icon:'hand-heart'},
    info: {label:'Conocer más',icon:'plus'}
  };
  const DEMO = [
    {department:'Petén',total:4,interests:{member:2,organization:1,donor:1,info:0}},
    {department:'Escuintla',total:5,interests:{member:3,organization:0,donor:1,info:1}},
    {department:'Guatemala',total:4,interests:{member:2,organization:1,donor:0,info:1}},
    {department:'Sacatepéquez',total:3,interests:{member:2,organization:0,donor:1,info:0}},
    {department:'Quetzaltenango',total:2,interests:{member:1,organization:1,donor:0,info:0}}
  ];
  const CALLOUTS = {'Petén':[366,95],'Escuintla':[255,500],'Guatemala':[369,380],'Sacatepéquez':[247,453],'Quetzaltenango':[61,355]};
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const canonicalDepartment = value => {
    const normalized = normalize(value).replace(/^departamento de /,'');
    if (['ciudad de guatemala','guatemala ciudad'].includes(normalized)) return 'Guatemala';
    if (['sacatepeques','zacatepeques','zacatepequez'].includes(normalized)) return 'Sacatepéquez';
    return DEPARTMENTS.find(name => normalize(name) === normalized) || null;
  };
  const canonicalInterest = value => {
    const normalized = normalize(value);
    const aliases = {member:'member',jet:'member','ser parte de jet':'member','quiero ser parte de jet':'member',organization:'organization',organizacion:'organization','colaborar como organizacion':'organization','quiero colaborar como organizacion':'organization',donor:'donor',donante:'donor','apoyar como donante':'donor','quiero apoyar como donante':'donor',info:'info','conocer mas':'info','quiero conocer mas':'info'};
    return aliases[normalized] || null;
  };
  const safeCount = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Math.min(Number(value),10000000) : 0;
  const emptyInterests = () => ({member:0,organization:0,donor:0,info:0});
  const sanitize = territories => {
    const records = new Map();
    for (const item of Array.isArray(territories) ? territories : []) {
      const department = canonicalDepartment(item?.department);
      if (!department) continue;
      const interests = emptyInterests();
      for (const [key,value] of Object.entries(item?.interests || {})) {
        const interest = canonicalInterest(key);
        if (interest) interests[interest] += safeCount(value);
      }
      const total = Math.max(safeCount(item.total),Object.values(interests).reduce((sum,count) => sum + count,0));
      const existing = records.get(department) || {department,total:0,interests:emptyInterests()};
      existing.total += total;
      for (const interest of Object.keys(INTERESTS)) existing.interests[interest] += interests[interest];
      records.set(department,existing);
    }
    return records;
  };
  let mode = 'demo';
  let demoRecords = sanitize(DEMO);
  let liveRecords = null;
  let records = demoRecords;
  let selected = 'Petén';
  let geometry = [];
  let root;
  let map;
  let markers;
  let latestConfirmed = null;
  const recordFor = department => records.get(department) || {department,total:0,interests:emptyInterests()};
  const svgNode = (tag,attributes = {}) => {
    const node = document.createElementNS(SVG_NS,tag);
    for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
    return node;
  };
  const makeIcon = (interest,size = 16) => {
    const icon = svgNode('svg',{viewBox:'0 0 24 24',width:size,height:size,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'});
    icon.append(svgNode('use',{href:`assets/icons.svg#icon-${INTERESTS[interest].icon}`}));
    return icon;
  };
  const selectDepartment = department => {
    const valid = canonicalDepartment(department);
    if (!valid) return;
    selected = valid;
    renderSelection();
  };
  const attachActivation = (node,department) => {
    node.addEventListener('click',() => selectDepartment(department));
    node.addEventListener('keydown',event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectDepartment(department);
      }
    });
  };
  const renderSelection = () => {
    if (!root) return;
    const record = recordFor(selected);
    root.querySelector('#territory-select').value = selected;
    root.querySelector('#territory-department-total').textContent = String(record.total);
    root.querySelector('#territory-department-label').textContent = `${record.total === 1 ? 'participación' : 'participaciones'} en ${selected}`;
    const list = root.querySelector('#territory-interests');
    list.replaceChildren();
    for (const [key,interest] of Object.entries(INTERESTS)) {
      const row = document.createElement('li');
      row.dataset.interest = key;
      row.dataset.empty = String(record.interests[key] === 0);
      row.append(makeIcon(key));
      const label = document.createElement('span');
      label.textContent = interest.label;
      const count = document.createElement('strong');
      count.textContent = String(record.interests[key]);
      row.append(label,count);
      list.append(row);
    }
    for (const node of root.querySelectorAll('[data-department]')) node.setAttribute('aria-pressed',String(node.dataset.department === selected));
  };
  const renderMarkers = () => {
    if (!markers) return;
    markers.replaceChildren();
    for (const feature of geometry) {
      const record = recordFor(feature.name);
      const path = root.querySelector(`[data-department="${feature.name}"]`);
      const available = Object.keys(INTERESTS).filter(key => record.interests[key] > 0);
      const dominant = available.reduce((best,key) => !best || record.interests[key] > record.interests[best] ? key : best,null);
      path.dataset.active = String(record.total > 0);
      path.dataset.interest = dominant || '';
      path.setAttribute('aria-label',`${feature.name}: ${record.total} ${record.total === 1 ? 'participación' : 'participaciones'}${mode === 'demo' ? ' de ejemplo' : ''}`);
      if (!record.total) continue;
      const anchor = feature.anchor;
      const [x,y] = CALLOUTS[feature.name] || anchor;
      const interestKeys = available.length ? available : ['member'];
      const width = 22 * interestKeys.length + 29;
      const marker = svgNode('g',{class:'territory-marker','data-department':feature.name,role:'button',tabindex:0,'aria-label':`${feature.name}: ${record.total} participaciones. Ver categorías.`,'aria-pressed':feature.name === selected});
      if (latestConfirmed === feature.name) marker.classList.add('is-confirmed');
      marker.append(svgNode('path',{class:'territory-marker-connector',d:`M${anchor[0]},${anchor[1]} L${x},${y}`}));
      marker.append(svgNode('circle',{class:'territory-marker-halo',cx:anchor[0],cy:anchor[1],r:8}));
      marker.append(svgNode('circle',{class:'territory-marker-center',cx:anchor[0],cy:anchor[1],r:4}));
      marker.append(svgNode('rect',{class:'territory-marker-bg',x:x-width/2,y:y-15,width,height:30,rx:15}));
      interestKeys.forEach((key,index) => {
        const icon = makeIcon(key,17);
        icon.setAttribute('x',String(x-width/2+8+index*22));
        icon.setAttribute('y',String(y-8.5));
        icon.setAttribute('class','territory-marker-icon');
        icon.dataset.interest = key;
        marker.append(icon);
      });
      const count = svgNode('text',{class:'territory-marker-count',x:x+width/2-14,y:y+5});
      count.textContent = String(record.total);
      marker.append(count);
      attachActivation(marker,feature.name);
      markers.append(marker);
    }
  };
  const render = () => {
    if (!root) return;
    const active = [...records.values()].filter(item => item.total > 0);
    root.dataset.mode = mode;
    root.querySelector('#territory-total').textContent = String(active.reduce((sum,item) => sum+item.total,0));
    root.querySelector('#territory-active').textContent = String(active.length);
    const badge = root.querySelector('#territory-mode');
    badge.dataset.mode = mode;
    badge.textContent = mode === 'demo' ? 'Vista ilustrativa' : 'Registros reales';
    for (const button of root.querySelectorAll('[data-territory-mode]')) {
      button.setAttribute('aria-pressed',String(button.dataset.territoryMode === mode));
      button.disabled = button.dataset.territoryMode === 'live' && liveRecords === null;
    }
    root.querySelector('#territory-explanation').textContent = mode === 'demo' ? 'Datos de ejemplo, no registros reales. Toca un territorio para explorar.' : active.length ? 'Registros guardados en JET. Toca un territorio para explorar la red.' : 'Todavía no hay registros por departamento. Tu energía puede abrir el camino.';
    renderMarkers();
    renderSelection();
  };
  const setData = data => {
    if (!data || !['demo','live'].includes(data.mode)) return false;
    mode = data.mode;
    records = sanitize(data.territories);
    if (mode === 'live') liveRecords = records;else demoRecords = records;
    latestConfirmed = null;
    if (!records.has(selected) || !recordFor(selected).total) selected = [...records.values()].find(item => item.total > 0)?.department || 'Guatemala';
    render();
    return true;
  };
  const showMode = requestedMode => {
    if (!['demo','live'].includes(requestedMode) || (requestedMode === 'live' && liveRecords === null)) return false;
    mode = requestedMode;
    records = mode === 'live' ? liveRecords : demoRecords;
    latestConfirmed = null;
    if (!records.has(selected) || !recordFor(selected).total) selected = [...records.values()].find(item => item.total > 0)?.department || 'Guatemala';
    render();
    return true;
  };
  const prepareLiveData = data => {
    if (!data || data.mode !== 'live' || !Array.isArray(data.territories)) return false;
    liveRecords = sanitize(data.territories);
    if (mode === 'live') return showMode('live');
    render();
    return true;
  };
  const addConfirmed = data => {
    const department = canonicalDepartment(data?.department);
    const interest = canonicalInterest(data?.interest);
    if (!department || !interest) return false;
    // A confirmation starts the live view. Illustrative entries are removed.
    if (mode !== 'live') {mode = 'live';records = liveRecords || new Map();}
    const record = recordFor(department);
    record.total += 1;
    record.interests[interest] += 1;
    records.set(department,record);
    liveRecords = records;
    selected = department;
    latestConfirmed = department;
    render();
    return true;
  };
  window.JETTerritory = Object.freeze({setData,prepareLiveData,showMode,addConfirmed,getSnapshot:() => ({mode,territories:[...records.values()].map(record => ({...record,interests:{...record.interests}}))})});
  const init = async () => {
    root = document.querySelector('#jet-territory');
    if (!root) return;
    map = root.querySelector('#territory-map');
    const select = root.querySelector('#territory-select');
    select.replaceChildren(...DEPARTMENTS.map(name => {
      const option = document.createElement('option');option.value=name;option.textContent=name;return option;
    }));
    select.addEventListener('change',() => selectDepartment(select.value));
    for (const button of root.querySelectorAll('[data-territory-mode]')) button.addEventListener('click',() => showMode(button.dataset.territoryMode));
    render();
    try {
      const response = await fetch('assets/guatemala-departments.json');
      if (!response.ok) throw new Error('Local map unavailable');
      const data = await response.json();
      if (!Array.isArray(data.departments) || data.departments.length !== 22) throw new Error('Invalid departmental geometry');
      geometry = data.departments;
      map.setAttribute('viewBox',data.viewBox.join(' '));
      const areas = svgNode('g',{class:'territory-areas'});
      for (const feature of geometry) {
        const path = svgNode('path',{class:'territory-department',d:feature.path,'fill-rule':'evenodd','data-department':feature.name,role:'button',tabindex:0,'aria-pressed':feature.name === selected});
        attachActivation(path,feature.name);
        areas.append(path);
      }
      markers = svgNode('g',{class:'territory-markers'});
      map.append(areas,markers);
      render();
    } catch (error) {
      root.querySelector('#territory-map-error').hidden = false;
      map.hidden = true;
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.dispatchEvent(new Event('jet:territory-ready'));
})();
