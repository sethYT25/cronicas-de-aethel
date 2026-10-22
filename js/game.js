/* =========================================================================
   CRÓNICAS DE AETHEL — Capa de juego e interfaz
   Pantallas, entrada de teclado y ratón, combate interactivo, música por
   síntesis en vivo y guardado en el navegador. Depende del motor y del
   adaptador de contenido.
   ========================================================================= */
(function (root) {
'use strict';

const E = root.AethelEngine;
const D = root.AETH;

/* ----------------------------- UTILIDADES UI ---------------------------- */
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const hex = a => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
const withAlpha = (c, a) => /^#([0-9a-f]{6})$/i.test(c) ? '#' + c.slice(1) + hex(a) : c;

/* ------------------------------- AUDIO ---------------------------------- */
const Audio8 = {
  ac: null, master: null, musicGain: null, sfxGain: null,
  enabled: true, musicOn: true, musicTimer: null, step: 0, mode: 'menu',
  start() {
    if (this.ac) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ac.destination);
    this.musicGain = this.ac.createGain();
    this.musicGain.gain.value = 0.26;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ac.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    this.schedule();
  },
  resume() { if (this.ac && this.ac.state === 'suspended') this.ac.resume(); },
  blip(type, freq, dur, gain, slide) {
    if (!this.ac || !this.enabled) return;
    const t = this.ac.currentTime;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.16, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, gain, freq) {
    if (!this.ac || !this.enabled) return;
    const t = this.ac.currentTime;
    const len = Math.max(1, Math.floor(this.ac.sampleRate * dur));
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ac.createBufferSource(); s.buffer = buf;
    const f = this.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = this.ac.createGain(); g.gain.value = gain || 0.4;
    s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t);
  },
  mclick() { this.blip('square', 620, 0.05, 0.09, 0.7); },
  mok() { this.blip('triangle', 880, 0.09, 0.1); setTimeout(() => this.blip('triangle', 1320, 0.12, 0.09), 70); },
  mno() { this.blip('square', 200, 0.12, 0.1, 0.6); },
  msfx(name) {
    if (name === 'hit') this.noise(0.16, 0.3, 1400);
    else if (name === 'crit') { this.noise(0.24, 0.45, 2200); this.blip('square', 320, 0.16, 0.12, 0.6); }
    else if (name === 'heal') { this.blip('triangle', 660, 0.16, 0.1); setTimeout(() => this.blip('triangle', 990, 0.2, 0.09), 90); }
    else if (name === 'levelup') { [523,659,784,1046].forEach((f,i) => setTimeout(() => this.blip('triangle', f, 0.2, 0.11), i*110)); }
    else if (name === 'gold') { this.blip('triangle', 1180, 0.08, 0.08); this.blip('triangle', 1560, 0.1, 0.07); }
    else if (name === 'down') { this.noise(0.6, 0.5, 700); this.blip('sawtooth', 160, 0.5, 0.12, 0.4); }
    else if (name === 'win') { [392,523,659,784].forEach((f,i) => setTimeout(() => this.blip('triangle', f, 0.22, 0.1), i*120)); }
  }
};

/* ----------------------------- ESTADO GLOBAL ---------------------------- */
const G = {
  screen: 'title',
  run: null,
  battle: null,
  target: 0,
  menu: 0,
  sel: 0,
  scroll: 0,
  pending: null,
  floaters: [],
  toast: null,
  confirm: null,
  options: null,
  anim: null,
  dmg: [],
  screenShake: 0
};

/* ------------------------------- MAPA ----------------------------------- */
function makeNodes() {
  const nodes = {};
  for (const zid in E.Data.zones) {
    const z = E.Data.zones[zid];
    nodes[zid] = { x: 0, y: 0, reqLevel: z.reqLevel, order: z.order };
  }
  const layout = {
    aldea_inicio:   { x: 0.12, y: 0.50 },
    bosque_umbrio:  { x: 0.26, y: 0.32 },
    ruinas_qarim:   { x: 0.42, y: 0.58 },
    cienaga_podrida:{ x: 0.56, y: 0.34 },
    ciudad_bajo:    { x: 0.68, y: 0.62 },
    picos_ceniza:   { x: 0.81, y: 0.36 },
    abismo_vacio:   { x: 0.92, y: 0.62 }
  };
  for (const k in layout) if (nodes[k]) { nodes[k].x = layout[k].x; nodes[k].y = layout[k].y; }
  return nodes;
}
const NODES = makeNodes();
let HORIZON = 0;

/* ------------------------------ RENDER ---------------------------------- */
function renderAll() {
  const stage = $('stage');
  stage.innerHTML = '';
  if (G.screen === 'title') stage.appendChild(screenTitle());
  else if (G.screen === 'class') stage.appendChild(screenClass());
  else if (G.screen === 'load') stage.appendChild(screenLoad());
  else stage.appendChild(frame(screenContent(), G.screen));
  if (G.toast) stage.appendChild(toastNode(G.toast));
  if (G.confirm) stage.appendChild(confirmNode(G.confirm));
}

function frame(content, screen) {
  const wrap = el('div', 'frame screen-' + screen);
  const zone = G.run ? E.Data.zones[G.run.zone] : null;
  const top = el('header', 'topbar');
  const brand = el('div', 'brand');
  brand.appendChild(el('span', 'brandMark', '✦'));
  brand.appendChild(el('span', 'brandName', 'CRÓNICAS DE AETHEL'));
  top.appendChild(brand);

  if (G.run && screen !== 'title') {
    const h = G.run.hero;
    const chips = el('div', 'chips');
    const chip = (cls, txt) => { const c = el('span', 'chip ' + cls); c.textContent = txt; return c; };
    chips.appendChild(chip('lv', `Nv ${h.level}`));
    chips.appendChild(chip('gold', `${h.gold} oro`));
    chips.appendChild(chip('zone', zone ? zone.name : ''));
    const d = new Date();
    chips.appendChild(chip('day', `Día ${G.run.day}`));
    if (h.skillPoints > 0) chips.appendChild(chip('pts', `${h.skillPoints} pt`));
    if (G.run.dungeon) chips.appendChild(chip('lvl', G.run.dungeon.name));
    top.appendChild(chips);
    const bars = el('div', 'bars');
    bars.appendChild(bar('hp', h.hp, h.maxHp, h.hp + ' / ' + h.maxHp));
    bars.appendChild(bar('mp', h.mp, h.maxMp, h.mp + ' / ' + h.maxMp));
    top.appendChild(bars);
  }
  wrap.appendChild(top);
  wrap.appendChild(el('div', 'rule'));
  wrap.appendChild(content);
  const foot = el('div', 'footer');
  foot.innerHTML = '<span>◀ ▶ moverte</span><span>Enter elegir</span><span>Esc volver</span><span>M música</span>';
  wrap.appendChild(foot);
  return wrap;
}

function bar(kind, v, max, label) {
  const b = el('div', 'bar ' + kind);
  const fill = el('div', 'barFill');
  fill.style.width = Math.max(0, Math.min(1, v / Math.max(1, max))) * 100 + '%';
  b.appendChild(fill);
  const t = el('span', 'barText', label);
  b.appendChild(t);
  return b;
}

function menuNode(items, onPick, opts) {
  opts = opts || {};
  const box = el('div', 'menu');
  items.forEach((it, i) => {
    if (!it) return;
    const b = el('button', 'item' + (i === G.menu ? ' sel' : '') + (it.disabled ? ' disabled' : ''));
    const left = el('span', 'itLeft', it.label);
    b.appendChild(left);
    if (it.hint) b.appendChild(el('span', 'itHint', it.hint));
    if (it.right) b.appendChild(el('span', 'itRight', it.right));
    b.addEventListener('mouseenter', () => { if (G.menu !== i) { G.menu = i; refreshSel(box); } });
    b.addEventListener('click', () => { if (!it.disabled) { Audio8.mclick(); onPick(i, it); } else Audio8.mno(); });
    box.appendChild(b);
  });
  return box;
}

function refreshSel(box) {
  const items = box.querySelectorAll('.item');
  items.forEach((n, i) => n.classList.toggle('sel', i === G.menu));
}

function moveMenu(delta, n) {
  if (!n) return;
  G.menu = (G.menu + delta + n) % n;
  Audio8.mclick();
  renderAll();
}

function toastNode(msg) {
  const t = el('div', 'toast', msg);
  return t;
}

function confirmNode(cfg) {
  const wrap = el('div', 'modal');
  const box = el('div', 'modalBox');
  box.appendChild(el('h3', null, cfg.title));
  box.appendChild(el('p', 'modalText', cfg.text || ''));
  const row = el('div', 'modalRow');
  const b1 = el('button', 'btn', cfg.ok || 'Confirmar');
  b1.addEventListener('click', () => { const f = cfg.onOk; G.confirm = null; Audio8.mok(); if (f) f(); renderAll(); });
  const b2 = el('button', 'btn ghost', 'Cancelar');
  b2.addEventListener('click', () => { G.confirm = null; Audio8.mno(); renderAll(); });
  row.appendChild(b1); row.appendChild(b2);
  box.appendChild(row);
  wrap.appendChild(box);
  return wrap;
}

/* ------------------------------- TÍTULO --------------------------------- */
function screenTitle() {
  const s = el('div', 'titleScreen');
  const art = el('div', 'titleArt');
  art.appendChild(el('div', 'glyph', '✦'));
  s.appendChild(art);
  s.appendChild(el('h1', 'big', 'CRÓNICAS DE AETHEL'));
  s.appendChild(el('p', 'sub', 'Un RPG por turnos: seis zonas, diez misiones, cuatro jefes y un mundo que se cierra a tu espalda.'));
  const saves = E.listSaves();
  const hay = saves.some(Boolean);
  const items = [
    { label: 'Nueva partida', hint: 'Elige clase y desciende' },
    hay ? { label: 'Continuar', hint: 'Partida guardada' } : { label: 'Continuar', hint: 'No hay partidas', disabled: true }
  ];
  if (hay) items.push({ label: 'Borrar partidas', hint: 'Todas las ranuras' });
  s.appendChild(menuNode(items, i => pickTitle(i, items), {}));
  const keys = el('div', 'keys');
  keys.innerHTML = '<span><b>◀ ▶</b> mover</span><span><b>Enter</b> elegir</span><span><b>Esc</b> volver</span><span><b>M</b> música</span>';
  s.appendChild(keys);
  return s;
}

function pickTitle(i, items) {
  const label = items[i].label;
  if (label === 'Nueva partida') { G.screen = 'class'; G.menu = 0; renderAll(); }
  else if (label === 'Continuar') { G.screen = 'load'; G.menu = 0; renderAll(); }
  else if (label === 'Borrar partidas') {
    G.confirm = {
      title: 'Borrar todas las partidas', text: 'Esta acción no se puede deshacer.',
      ok: 'Borrar',
      onOk: () => { for (let k = 0; k < 3; k++) E.deleteSave(k); G.toast = 'Partidas borradas'; renderAll(); }
    };
    renderAll();
  }
}

function screenClass() {
  const s = el('div', 'classScreen');
  s.appendChild(el('h2', 'h2', 'Elige tu camino'));
  const grid = el('div', 'classGrid');
  const keys = Object.keys(E.Data.classes);
  keys.forEach((cid, i) => {
    const c = E.Data.classes[cid];
    const card = el('div', 'classCard' + (i === G.menu ? ' sel' : ''));
    card.style.setProperty('--cls', c.color);
    card.appendChild(el('div', 'className', c.name));
    card.appendChild(el('div', 'classRole', c.role));
    card.appendChild(el('p', 'classDesc', c.desc));
    const st = el('div', 'classStats');
    const stats = [
      ['Vida', c.base.hp], ['Maná', c.base.mp], ['FUE', c.base.str], ['DES', c.base.dex],
      ['INT', c.base.int], ['CON', c.base.con], ['SAB', c.base.wis], ['SUE', c.base.luck]
    ];
    for (const [k, v] of stats) {
      const row = el('div', 'cstat');
      row.appendChild(el('span', null, k));
      row.appendChild(el('b', null, String(v)));
      st.appendChild(row);
    }
    card.appendChild(st);
    const inic = el('div', 'classSkills');
    for (const sid of (c.startSkills || []).slice(0, 3)) {
      const chip = el('span', 'skillChip', E.Data.skills[sid].name);
      inic.appendChild(chip);
    }
    card.appendChild(inic);
    card.addEventListener('mouseenter', () => { G.menu = i; renderAll(); });
    card.addEventListener('click', () => { Audio8.mok(); startNew(keys[i]); });
    grid.appendChild(card);
  });
  s.appendChild(grid);
  return s;
}

function startNew(classId) {
  G.run = E.newRun(classId);
  G.run.questLog = {};
  E.initStock(G.run, 'aldea_inicio');
  Audio8.mode = 'field';
  G.screen = 'map';
  G.menu = 0;
  G.toast = null;
  autosave('Partida iniciada');
  renderAll();
}

function screenLoad() {
  const s = el('div', 'loadScreen');
  s.appendChild(el('h2', 'h2', 'Ranuras de guardado'));
  const saves = E.listSaves();
  const items = saves.map((sv, i) => sv
    ? { label: `Ranura ${i + 1}: ${sv.name}`, hint: `Nv ${sv.level} · ${E.Data.zones[sv.zone].name} · ${sv.gold} oro · día ${sv.day}` }
    : { label: `Ranura ${i + 1}: vacía`, hint: 'sin partida', disabled: true });
  s.appendChild(menuNode(items, i => {
    const run = E.loadFrom(i);
    if (!run) { G.toast = 'No se pudo cargar'; renderAll(); return; }
    G.run = run;
    Audio8.mode = 'field';
    G.screen = 'map';
    G.menu = 0;
    renderAll();
  }, {}));
  return s;
}

/* -------------------------------- MAPA ---------------------------------- */
function screenContent() {
  switch (G.screen) {
    case 'map': return viewMap();
    case 'zone': return viewZone();
    case 'battle': return viewBattle();
    case 'dungeon': return viewDungeon();
    case 'inventory': return viewInventory();
    case 'shop': return viewShop();
    case 'skills': return viewSkills();
    case 'quests': return viewQuests();
    case 'character': return viewCharacter();
    case 'saves': return viewSaves();
    case 'gameover': return viewGameOver();
    case 'victory': return viewVictory();
    default: return viewMap();
  }
}

function viewMap() {
  const run = G.run;
  const wrap = el('div', 'mapWrap');
  const head = el('div', 'viewHead');
  head.appendChild(el('h2', 'h2', 'Mapa de Aethel'));
  head.appendChild(el('p', 'sub', 'Recorre las seis regiones. Cada una cobra su precio en sangre o en oro.'));
  wrap.appendChild(head);

  const map = el('div', 'map big');
  Object.keys(E.Data.zones).forEach(zid => {
    const z = E.Data.zones[zid];
    const n = NODES[zid];
    const unlocked = !z.unlock || run.flags[z.unlock];
    const lv = run.hero.level >= z.reqLevel;
    const node = el('button', 'node' + (run.zone === zid ? ' here' : '') + (unlocked && lv ? ' open' : ' locked'));
    node.style.left = (n.x * 100) + '%';
    node.style.top = (n.y * 100) + '%';
    const dot = el('span', 'dot');
    node.appendChild(dot);
    const label = el('span', 'nodeLabel', z.name);
    node.appendChild(label);
    const meta = el('span', 'nodeMeta', z.safe ? 'segura' : `nivel ${z.reqLevel}+`);
    node.appendChild(meta);
    node.addEventListener('click', () => {
      if (!unlocked) { G.toast = 'El camino está cerrado. Avanza en la historia.'; Audio8.mno(); renderAll(); return; }
      if (!lv) { G.toast = `Necesitas nivel ${z.reqLevel}.`; Audio8.mno(); renderAll(); return; }
      Audio8.mok();
      E.travelTo(run, zid);
      G.screen = 'zone';
      G.menu = 0;
      renderAll();
    });
    map.appendChild(node);
  });
  wrap.appendChild(map);

  const quick = menuNode([
    { label: 'Explorar la zona', hint: E.Data.zones[run.zone].name },
    { label: 'Ir a la zona actual', hint: 'Ver qué hay aquí' },
    { label: 'Personaje', hint: `Nivel ${run.hero.level} · ${run.hero.gold} oro` },
    { label: 'Inventario', hint: `${run.hero.bag.length + run.hero.potions} objetos` },
    { label: 'Guardar partida', hint: 'Tres ranuras' }
  ], i => {
    if (i === 0) { G.screen = 'zone'; G.menu = 0; renderAll(); }
    if (i === 1) { G.screen = 'zone'; G.menu = 0; renderAll(); }
    if (i === 2) { G.screen = 'character'; G.menu = 0; renderAll(); }
    if (i === 3) { G.screen = 'inventory'; G.menu = 0; renderAll(); }
    if (i === 4) { G.screen = 'saves'; G.menu = 0; renderAll(); }
  }, {});
  wrap.appendChild(quick);
  return wrap;
}

function viewZone() {
  const run = G.run;
  const z = E.Data.zones[run.zone];
  const wrap = el('div', 'zoneWrap');
  const head = el('div', 'viewHead');
  head.appendChild(el('h2', 'h2', z.name));
  head.appendChild(el('p', 'sub', z.desc));
  wrap.appendChild(head);

  if (G.run.pending) { wrap.appendChild(rewardPanel()); return wrap; }

  const items = [];
  items.push({ label: run.dungeon ? 'Continuar en la mazmorra' : 'Adentrarse en la zona', hint: z.safe ? 'Volver al mapa' : `Peligro ${Math.round(z.encounter * 100)}%`, act: 'explore' });
  if (z.dungeon && !run.dungeon) items.push({ label: 'Buscar una mazmorra', hint: 'Mazmorra generada por procedimiento', act: 'dungeon' });
  if (run.dungeon) items.push({ label: 'Salir de la mazmorra', hint: 'Volver a la superficie', act: 'leaveDungeon' });
  if (z.safe) {
    items.push({ label: 'Tienda', hint: `${z.shop.length} objetos en venta`, act: 'shop' });
    items.push({ label: `Posada (${z.innCost} oro)`, hint: 'Vida y maná al máximo', act: 'inn' });
    const avail = E.availableQuests(run, run.zone);
    const activas = E.activeQuests(run);
    items.push({ label: 'Misiones', hint: avail.length ? `${avail.length} disponibles` : `${activas.length} en curso`, act: 'quests' });
  }
  items.push({ label: 'Personaje', hint: `Nivel ${run.hero.level}`, act: 'character' });
  items.push({ label: 'Inventario', hint: `${run.hero.bag.length} objetos`, act: 'inventory' });
  items.push({ label: 'Mapa', hint: 'Viajar a otra región', act: 'map' });
  items.push({ label: 'Guardar', hint: 'Ranuras', act: 'saves' });
  wrap.appendChild(menuNode(items, i => doAction(items[i].act), {}));

  const last = run.log.entries.slice(-6).reverse();
  if (last.length) {
    const box = el('div', 'logBox small');
    for (const e of last) box.appendChild(el('div', 'logLine ' + e.kind, e.text));
    wrap.appendChild(box);
  }
  return wrap;
}

function rewardPanel() {
  const p = G.run.pending;
  const box = el('div', 'rewardPanel');
  box.appendChild(el('h3', 'h3', 'Resultado'));
  box.appendChild(el('p', 'sub', p.text || ''));
  if (p.xp) box.appendChild(el('div', 'rw', `+${p.xp} EXP`));
  if (p.gold) box.appendChild(el('div', 'rw', `+${p.gold} oro`));
  if (p.items && p.items.length) box.appendChild(el('div', 'rw', p.items.map(i => E.displayItemName(i)).join(', ')));
  if (p.levels && p.levels.length) box.appendChild(el('div', 'rw up', `¡Subes al nivel ${p.levels[p.levels.length - 1].level}!`));
  box.appendChild(menuNode([{ label: 'Continuar' }], () => { G.run.pending = null; Audio8.mclick(); renderAll(); }, {}));
  return box;
}

function doAction(act) {
  const run = G.run;
  switch (act) {
    case 'explore': {
      if (E.Data.zones[run.zone].safe) { G.toast = 'Aquí no hay nada que explorar. Viaja a otra región.'; renderAll(); return; }
      const r = E.exploreStep(run);
      if (r.type === 'battle') startBattle(r.enemies, { zone: run.zone, title: r.title });
      else {
        if (r.type === 'loot') G.toast = 'Has encontrado un objeto.';
        if (r.type === 'gold') G.toast = `Has recogido ${r.amount} monedas.`;
        renderAll();
      }
      break;
    }
    case 'dungeon': {
      const r = E.enterDungeon(run);
      if (!r.ok) { G.toast = r.why; renderAll(); return; }
      G.screen = 'dungeon';
      G.menu = 0;
      renderAll();
      break;
    }
    case 'leaveDungeon': E.leaveDungeon(run); G.screen = 'zone'; G.menu = 0; renderAll(); break;
    case 'shop': G.screen = 'shop'; G.menu = 0; renderAll(); break;
    case 'quests': G.screen = 'quests'; G.menu = 0; renderAll(); break;
    case 'character': G.screen = 'character'; G.menu = 0; renderAll(); break;
    case 'inventory': G.screen = 'inventory'; G.menu = 0; renderAll(); break;
    case 'map': G.screen = 'map'; G.menu = 0; renderAll(); break;
    case 'saves': G.screen = 'saves'; G.menu = 0; renderAll(); break;
    case 'inn': {
      const r = E.restAtInn(run);
      if (!r.ok) { G.toast = r.why; Audio8.mno(); }
      else { G.toast = 'Has dormido hasta el amanecer.'; Audio8.mok(); }
      renderAll();
      break;
    }
  }
}

/* ------------------------------ MAZMORRA -------------------------------- */
function viewDungeon() {
  const run = G.run, d = run.dungeon;
  const wrap = el('div', 'dungeonWrap');
  if (!d) { wrap.appendChild(el('p', 'sub', 'No estás en ninguna mazmorra.')); return wrap; }
  const head = el('div', 'viewHead');
  head.appendChild(el('h2', 'h2', d.name));
  head.appendChild(el('p', 'sub', `Sala ${d.current + 1} de ${d.rooms.length} · profundidad ${d.depth}`));
  wrap.appendChild(head);
  wrap.appendChild(progressTrack(d));

  const room = E.dungeonRoom(run);
  if (!room) { wrap.appendChild(el('p', 'sub', 'Sala desconocida.')); return wrap; }
  if (G.run.pending) { wrap.appendChild(rewardPanel()); return wrap; }

  const kind = { entrance: 'Entrada', combat: 'Criaturas', boss: 'Jefe', treasure: 'Tesoro', rest: 'Cámara segura' }[room.type];
  const box = el('div', 'roomBox type-' + room.type);
  box.appendChild(el('h3', 'h3', kind));
  if (room.type === 'combat' || room.type === 'boss') {
    const names = room.data.enemies.map(e => `${e.name} (Nv ${e.level})`).join(' · ');
    box.appendChild(el('p', 'sub', names));
  } else if (room.type === 'treasure') box.appendChild(el('p', 'sub', 'Un cofre cerrado con algo dentro que suena a metal.'));
  else if (room.type === 'rest') box.appendChild(el('p', 'sub', 'Un rincón sin corrientes. Puedes recuperar fuerzas.'));
  else box.appendChild(el('p', 'sub', 'Escaleras que bajan. Huele a humedad.'));
  wrap.appendChild(box);

  const items = [];
  if (room.type === 'combat' || room.type === 'boss') {
    items.push({ label: 'Combatir', hint: room.type === 'boss' ? 'Sin retirada' : 'Tienes la iniciativa', act: 'fight' });
    items.push({ label: 'Retroceder', hint: 'Vuelves a la sala anterior', act: 'back' });
  } else if (room.type === 'treasure') {
    items.push({ label: 'Abrir el cofre', hint: 'Botín aleatorio', act: 'open' });
    items.push({ label: 'Avanzar', hint: 'Ignorar el cofre', act: 'next' });
    items.push({ label: 'Retroceder', hint: 'Volver atrás', act: 'back' });
  } else if (room.type === 'rest') {
    items.push({ label: 'Descansar', hint: 'Recupera vida y maná', act: 'rest' });
    items.push({ label: 'Avanzar', hint: 'Seguir bajando', act: 'next' });
    items.push({ label: 'Retroceder', hint: 'Volver atrás', act: 'back' });
  } else {
    items.push({ label: 'Avanzar', hint: 'Siguiente sala', act: 'next' });
    items.push({ label: 'Salir de la mazmorra', hint: 'Volver a la superficie', act: 'leave' });
  }
  items.push({ label: 'Inventario', hint: `${run.hero.bag.length} objetos`, act: 'inventory' });
  wrap.appendChild(menuNode(items, i => dungeonAction(items[i].act, room), {}));

  const last = run.log.entries.slice(-5).reverse();
  if (last.length) {
    const lb = el('div', 'logBox small');
    for (const e of last) lb.appendChild(el('div', 'logLine ' + e.kind, e.text));
    wrap.appendChild(lb);
  }
  return wrap;
}

function progressTrack(d) {
  const t = el('div', 'track');
  d.rooms.forEach((r, i) => {
    const n = el('span', 'tick ' + r.type + (i < d.current ? ' done' : (i === d.current ? ' now' : '')));
    t.appendChild(n);
  });
  return t;
}

function dungeonAction(act, room) {
  const run = G.run;
  switch (act) {
    case 'fight': startBattle(room.data.enemies, { zone: run.zone, title: room.data.title, kind: room.type, inDungeon: true }); break;
    case 'open': {
      const r = E.dungeonReward(run, room);
      if (r) { G.toast = `Encuentras ${r.item ? E.displayItemName(r.item) : 'algo'}.`; Audio8.msfx('gold'); }
      E.advanceDungeon(run);
      renderAll();
      break;
    }
    case 'rest': {
      E.dungeonReward(run, room);
      G.toast = 'Has recuperado fuerzas.';
      Audio8.msfx('heal');
      E.advanceDungeon(run);
      renderAll();
      break;
    }
    case 'next': {
      const r = E.advanceDungeon(run);
      if (r.done) {
        G.toast = 'Has completado la mazmorra.';
        Audio8.msfx('win');
        E.leaveDungeon(run);
        G.screen = 'zone';
        G.menu = 0;
      }
      renderAll();
      break;
    }
    case 'back': {
      if (run.dungeon.current > 0) run.dungeon.current--;
      renderAll();
      break;
    }
    case 'leave': E.leaveDungeon(run); G.screen = 'zone'; G.menu = 0; renderAll(); break;
    case 'inventory': G.screen = 'inventory'; G.menu = 0; G.scroll = 0; renderAll(); break;
  }
}

/* ------------------------------- COMBATE -------------------------------- */
function startBattle(enemies, opts) {
  const b = E.startBattle(G.run.hero, enemies, opts);
  b.run = G.run;
  G.battle = b;
  G.screen = 'battle';
  G.menu = 0;
  G.target = 0;
  G.anim = null;
  G.dmg = [];
  G.battle.pending = null;
  Audio8.mode = opts && opts.kind === 'boss' ? 'boss' : 'battle';
  if (b.active.kind === 'hero') b.pending = { kind: 'hero' };
  else { b.pending = { kind: 'enemy' }; enemyAct(); }
  renderAll();
}

function viewBattle() {
  const b = G.battle;
  const wrap = el('div', 'battleWrap');
  if (!b) return wrap;
  if (b.over) { return viewBattleEnd(); }

  const arena = el('div', 'arena');
  arena.appendChild(enemyRow(b));
  arena.appendChild(heroRow(b));
  if (G.anim) arena.appendChild(el('div', 'fx fx-' + G.anim));
  wrap.appendChild(arena);

  wrap.appendChild(turnBar(b));

  const logBox = el('div', 'logBox');
  for (const e of b.log.entries.slice(-9)) logBox.appendChild(el('div', 'logLine ' + e.kind, e.text));
  wrap.appendChild(logBox);

  if (b.pending && b.pending.kind === 'hero') wrap.appendChild(actionMenu(b));
  else wrap.appendChild(el('p', 'sub turnHint', 'El enemigo está decidiendo...'));
  return wrap;
}

function unitCard(u, opts) {
  opts = opts || {};
  const card = el('div', 'unit' + (opts.active ? ' active' : '') + (u.hp <= 0 ? ' dead' : '') + (opts.boss ? ' boss' : '') + (opts.targeted ? ' targeted' : ''));
  if (u.kind === 'hero') card.classList.add('hero', 'cls-' + u.classId);
  const art = el('div', 'unitArt art-' + (u.kind === 'hero' ? u.classId : u.art));
  art.appendChild(el('span', 'artGlyph', u.kind === 'hero' ? '☗' : '❖'));
  card.appendChild(art);
  const info = el('div', 'unitInfo');
  info.appendChild(el('div', 'unitName', u.name));
  info.appendChild(el('div', 'unitLv', u.kind === 'hero' ? `Nivel ${u.level}` : `Nivel ${u.level}`));
  info.appendChild(bar('hp', u.hp, u.maxHp, `${u.hp}/${u.maxHp}`));
  if (u.kind === 'hero') info.appendChild(bar('mp', u.mp, u.maxMp, `${u.mp}/${u.maxMp}`));
  if (u.statuses.length) {
    const st = el('div', 'statusRow');
    for (const s of u.statuses) {
      const d = E.Data.statuses[s.id];
      if (!d) continue;
      const chip = el('span', 'st ' + (d.bad ? 'bad' : 'good'), `${d.name} ${s.turns}`);
      st.appendChild(chip);
    }
    info.appendChild(st);
  }
  card.appendChild(info);
  if (opts.onClick) card.addEventListener('click', opts.onClick);
  return card;
}

function enemyRow(b) {
  const row = el('div', 'enemyRow');
  b.enemies.forEach((e, i) => {
    const card = unitCard(e, {
      active: b.active === e,
      boss: e.boss,
      targeted: i === G.target,
      onClick: () => { G.target = i; Audio8.mclick(); renderAll(); }
    });
    if (G.dmg.find(d => d.unit === e.id)) {
      const d = G.dmg.find(x => x.unit === e.id);
      card.appendChild(el('span', 'dmgNum' + (d.crit ? ' crit' : ''), String(d.value)));
    }
    row.appendChild(card);
  });
  return row;
}

function heroRow(b) {
  const row = el('div', 'heroRow');
  row.appendChild(unitCard(b.hero, { active: b.active === b.hero }));
  return row;
}

function turnBar(b) {
  const t = el('div', 'turnBar');
  t.appendChild(el('span', 'turnLabel', `Ronda ${b.round}`));
  for (const u of b.order) {
    const n = el('span', 'tn' + (u === b.active ? ' now' : '') + (u.hp <= 0 ? ' off' : '') + (u.kind === 'hero' ? ' hero' : ''));
    n.textContent = u.kind === 'hero' ? 'Tú' : u.name.split(' ')[0];
    t.appendChild(n);
  }
  return t;
}

function actionMenu(b) {
  const h = b.hero;
  const items = [
    { label: 'Atacar', hint: b.enemies[G.target] ? 'Contra ' + b.enemies[G.target].name : '', act: 'attack' },
    { label: 'Habilidades', hint: `${E.usableSkills(h).length} disponibles`, act: 'skills' },
    { label: 'Objetos', hint: `${h.bag.length} objetos · ${h.potions} pociones`, act: 'items' },
    { label: 'Defenderse', hint: 'Reduce el daño recibido', act: 'defend' },
    { label: b.kind === 'boss' ? 'Huir (imposible)' : 'Huir', hint: b.kind === 'boss' ? 'Es un jefe' : 'Puede fallar', act: 'flee' }
  ];
  return menuNode(items, i => battleAction(items[i].act), {});
}

function battleAction(act) {
  const b = G.battle;
  if (!b || b.over) return;
  if (act === 'attack') {
    const t = b.enemies[G.target] && b.enemies[G.target].hp > 0 ? b.enemies[G.target] : E.pickTarget(b, null);
    if (!t) return;
    const before = t.hp;
    E.heroAction(b, { type: 'attack', targetId: t.id });
    feedback(t, before - t.hp, false);
    Audio8.msfx('hit');
    afterHeroAction();
  } else if (act === 'skills') {
    G.options = { kind: 'skills' };
    G.menu = 0;
    renderAll();
    return;
  } else if (act === 'items') {
    G.options = { kind: 'items' };
    G.menu = 0;
    renderAll();
    return;
  } else if (act === 'defend') {
    E.heroAction(b, { type: 'defend' });
    Audio8.mclick();
    afterHeroAction();
  } else if (act === 'flee') {
    const r = E.heroAction(b, { type: 'flee' });
    if (r.ok && r.fled) { endBattleFlow(); return; }
    Audio8.mno();
    afterHeroAction();
  }
}

function feedback(unit, value, crit) {
  if (value > 0) {
    G.dmg = [{ unit: unit.id, value, crit: !!crit }];
    G.anim = crit ? 'crit' : 'hit';
    G.screenShake = crit ? 1 : 0.5;
    setTimeout(() => { G.anim = null; G.dmg = []; G.screenShake = 0; renderAll(); }, 430);
  }
}

function afterHeroAction() {
  const b = G.battle;
  if (b.over) { endBattleFlow(); return; }
  E.nextTurn(b);
  if (b.over) { endBattleFlow(); return; }
  if (b.active.kind === 'hero') { b.pending = { kind: 'hero' }; renderAll(); }
  else { b.pending = { kind: 'enemy' }; renderAll(); setTimeout(enemyAct, 620); }
}

function enemyAct() {
  const b = G.battle;
  if (!b || b.over) return;
  const before = b.hero.hp;
  E.enemyTurn(b, b.active.id);
  const dealt = before - b.hero.hp;
  if (dealt > 0) { feedback(b.hero, dealt, false); Audio8.msfx('hit'); }
  else { G.anim = 'miss'; setTimeout(() => { G.anim = null; renderAll(); }, 380); }
  if (b.over) { setTimeout(endBattleFlow, 420); return; }
  E.nextTurn(b);
  if (b.over) { setTimeout(endBattleFlow, 420); return; }
  if (b.active.kind === 'hero') { b.pending = { kind: 'hero' }; renderAll(); }
  else { setTimeout(enemyAct, 620); }
}

function endBattleFlow() {
  const b = G.battle;
  const run = G.run;
  E.applyBattle(run, b);
  Audio8.mode = 'field';
  if (b.result === 'win') {
    Audio8.msfx('win');
    const rw = b.rewards || { xp: 0, gold: 0, drops: [] };
    const items = rw.drops.map(id => ({ id }));
    G.run.pending = {
      xp: rw.xp, gold: rw.gold, items,
      levels: rw.events || [],
      text: b.kind === 'boss' ? 'El jefe ha caído.' : 'El combate ha terminado a tu favor.'
    };
    if (rw.events && rw.events.length) Audio8.msfx('levelup');
    autosave();
    G.screen = b.inDungeon ? 'dungeon' : 'zone';
  } else if (b.result === 'lose') {
    Audio8.msfx('down');
    G.screen = 'gameover';
  } else {
    G.screen = b.inDungeon ? 'dungeon' : 'zone';
    G.toast = 'Has escapado.';
  }
  G.battle = null;
  G.options = null;
  G.menu = 0;
  renderAll();
}

function viewBattleEnd() {
  const wrap = el('div', 'battleEnd');
  wrap.appendChild(el('h2', 'h2', 'Fin del combate'));
  wrap.appendChild(el('p', 'sub', 'Continúa tu viaje.'));
  wrap.appendChild(menuNode([{ label: 'Continuar' }], () => { G.battle = null; renderAll(); }, {}));
  return wrap;
}

/* ---------------------- SUBMENÚS DE COMBATE ---------------------------- */
function optionsOverlay() {
  const b = G.battle;
  const o = G.options;
  const wrap = el('div', 'subMenu');
  const box = el('div', 'subBox');
  if (o.kind === 'skills') {
    box.appendChild(el('h3', 'h3', 'Habilidades'));
    const list = E.usableSkills(b.hero);
    if (!list.length) box.appendChild(el('p', 'sub', 'Aún no has aprendido ninguna habilidad. Sube de nivel y reparte puntos.')).valueOf();
    const items = list.map(s => ({
      label: s.skill.name,
      hint: s.skill.desc,
      right: `${s.cost} PM · rango ${s.rank}`,
      disabled: !s.ready
    }));
    items.push({ label: 'Volver', hint: '' });
    box.appendChild(menuNode(items, i => {
      if (i === items.length - 1) { G.options = null; G.menu = 0; renderAll(); return; }
      const s = list[i];
      if (!s.ready) { Audio8.mno(); G.toast = 'Maná insuficiente.'; renderAll(); return; }
      const t = b.enemies[G.target] && b.enemies[G.target].hp > 0 ? b.enemies[G.target] : E.pickTarget(b, null);
      const before = t ? t.hp : 0;
      const beforeHeroMp = b.hero.mp;
      const r = E.heroAction(b, { type: 'skill', skillId: s.id, targetId: t ? t.id : null });
      if (r.ok === false) { G.toast = r.why; Audio8.mno(); renderAll(); return; }
      G.options = null;
      if (t) feedback(t, before - t.hp, false);
      if (b.hero.mp < beforeHeroMp) Audio8.mclick();
      if (s.skill.kind === 'heal' || s.skill.kind === 'cleanse' || s.skill.kind === 'buff') Audio8.msfx('heal');
      else Audio8.msfx('hit');
      if (b.over) { setTimeout(endBattleFlow, 400); return; }
      afterHeroAction();
    }, {}));
  } else {
    box.appendChild(el('h3', 'h3', 'Objetos'));
    const items = [{ label: `Poción (${b.hero.potions})`, hint: 'Restaura 40% de vida' }];
    for (const it of b.hero.bag) {
      const def = E.Data.items[it.id];
      if (!def) continue;
      items.push({ label: E.displayItemName(it), hint: def.desc || '', right: def.kind === 'consumable' ? 'usar' : 'no usable', disabled: def.kind !== 'consumable' });
    }
    items.push({ label: 'Volver' });
    box.appendChild(menuNode(items, i => {
      if (i === items.length - 1) { G.options = null; G.menu = 0; renderAll(); return; }
      if (i === 0) {
        const r = E.usePotion(b.hero, b.log);
        if (!r.ok) { G.toast = r.why; Audio8.mno(); renderAll(); return; }
        feedback(b.hero, r.amount, false);
        Audio8.msfx('heal');
      } else {
        const uid = b.hero.bag.filter(it => E.Data.items[it.id] && E.Data.items[it.id].kind === 'consumable')[i - 1];
        if (!uid) return;
        const r = E.useBagItem(b.hero, uid.uid, true, b.log, b);
        if (r.ok === false) { G.toast = r.why; Audio8.mno(); renderAll(); return; }
        Audio8.msfx('heal');
      }
      G.options = null;
      if (b.over) { setTimeout(endBattleFlow, 400); return; }
      afterHeroAction();
    }, {}));
  }
  wrap.appendChild(box);
  const cancel = el('button', 'btn ghost', 'Cerrar');
  cancel.addEventListener('click', () => { G.options = null; G.menu = 0; Audio8.mno(); renderAll(); });
  wrap.appendChild(cancel);
  return wrap;
}

/* ----------------------------- INVENTARIO ------------------------------- */
function viewInventory() {
  const run = G.run, h = run.hero;
  const wrap = el('div', 'invWrap');
  wrap.appendChild(el('h2', 'h2', 'Inventario'));
  const grid = el('div', 'invGrid');
  const gear = el('div', 'gearBox');
  gear.appendChild(el('h3', 'h3', 'Equipamiento'));
  for (const slot of ['weapon', 'armor', 'head', 'trinket']) {
    const it = h.gear[slot];
    const row = el('div', 'gearRow');
    row.appendChild(el('span', 'gearSlot', { weapon: 'Arma', armor: 'Cuerpo', head: 'Cabeza', trinket: 'Accesorio' }[slot]));
    if (it) {
      const r = E.displayItemRarity(it);
      const name = el('span', 'gearName', E.displayItemName(it));
      name.style.color = r.color;
      row.appendChild(name);
      const b = el('button', 'mini', 'Quitar');
      b.addEventListener('click', () => { E.unequip(h, slot); Audio8.mclick(); renderAll(); });
      row.appendChild(b);
    } else row.appendChild(el('span', 'gearName dim', '— vacío —'));
    gear.appendChild(row);
  }
  const totals = el('div', 'gearTotals');
  totals.innerHTML = `<b>Vida</b> ${h.maxHp} &nbsp; <b>Maná</b> ${h.maxMp} &nbsp; <b>Ataque</b> ${E.heroAttack(h)} &nbsp; <b>Defensa</b> ${E.heroDefense(h)} &nbsp; <b>Magia</b> ${E.heroMagic(h)}`;
  gear.appendChild(totals);
  grid.appendChild(gear);

  const bag = el('div', 'bagBox');
  bag.appendChild(el('h3', 'h3', `Mochila (${h.bag.length})`));
  const items = [];
  items.push({ label: `Pociones: ${h.potions}`, hint: 'Se usan en combate', disabled: true });
  for (const it of h.bag) {
    const def = E.Data.items[it.id];
    if (!def) continue;
    const rar = E.displayItemRarity(it);
    const canEquip = !!def.slot;
    const usable = def.kind === 'consumable';
    items.push({
      label: E.displayItemName(it),
      hint: def.desc,
      right: canEquip ? 'equipar' : (usable ? 'usar' : (def.kind === 'material' ? 'material' : 'vender')),
      disabled: !canEquip && !usable,
      item: it
    });
  }
  if (!h.bag.length) items.push({ label: 'Mochila vacía', hint: '', disabled: true });
  items.push({ label: 'Volver' });
  bag.appendChild(menuNode(items, i => {
    const it = items[i].item;
    if (i === items.length - 1) { G.screen = G.run.dungeon ? 'dungeon' : 'zone'; G.menu = 0; renderAll(); return; }
    if (!it) return;
    const def = E.Data.items[it.id];
    if (def.slot) { E.equip(h, it.uid); G.toast = `Has equipado ${E.displayItemName(it)}.`; Audio8.mok(); }
    else if (def.kind === 'consumable') {
      const r = E.useBagItem(h, it.uid, false, null, null);
      G.toast = r.ok ? `Has usado ${def.name}.` : r.why;
      Audio8.msfx('heal');
    }
    renderAll();
  }, {}));
  grid.appendChild(bag);
  wrap.appendChild(grid);
  return wrap;
}

/* -------------------------------- TIENDA -------------------------------- */
function viewShop() {
  const run = G.run, h = run.hero, z = E.Data.zones[run.zone];
  const wrap = el('div', 'shopWrap');
  if (!z.safe) { wrap.appendChild(el('p', 'sub', 'Aquí no hay tienda.')); return wrap; }
  wrap.appendChild(el('h2', 'h2', `Tienda de ${z.name}`));
  wrap.appendChild(el('p', 'sub', `Oro disponible: ${h.gold}`));
  const items = [];
  for (const id of z.shop) {
    const it = E.Data.items[id];
    if (!it) continue;
    const price = Math.round(it.price * (z.priceMult || 1));
    const stock = it.stock ? E.shopStock(run, id) : null;
    items.push({
      label: it.name, hint: it.desc,
      right: `${price} oro${stock != null ? ' · ' + stock + ' uds' : ''}`,
      disabled: h.gold < price || (stock != null && stock <= 0),
      id
    });
  }
  items.push({ label: 'Volver' });
  wrap.appendChild(menuNode(items, i => {
    if (i === items.length - 1) { G.screen = 'zone'; G.menu = 0; renderAll(); return; }
    const r = E.buyFromShop(run, items[i].id);
    if (r.ok) { G.toast = `Has comprado ${E.Data.items[items[i].id].name}.`; Audio8.msfx('gold'); }
    else { G.toast = r.why; Audio8.mno(); }
    renderAll();
  }, {}));

  if (h.bag.length) {
    const sellItems = h.bag.map(it => ({
      label: E.displayItemName(it),
      hint: E.Data.items[it.id] ? E.Data.items[it.id].desc : '',
      right: `${Math.round(E.itemValue(it) * 0.4)} oro`,
      item: it
    }));
    sellItems.push({ label: 'No vender nada' });
    const box = el('div', 'sellBox');
    box.appendChild(el('h3', 'h3', 'Vender'));
    box.appendChild(menuNode(sellItems, i => {
      if (i === sellItems.length - 1) return;
      const r = E.sellToShop(run, sellItems[i].item.uid);
      if (r.ok) { G.toast = `Has vendido por ${r.value} oro.`; Audio8.msfx('gold'); }
      renderAll();
    }, {}));
    wrap.appendChild(box);
  }
  return wrap;
}

/* ------------------------------ HABILIDADES ----------------------------- */
function viewSkills() {
  const run = G.run, h = run.hero;
  const wrap = el('div', 'skillWrap');
  wrap.appendChild(el('h2', 'h2', 'Árbol de habilidades'));
  wrap.appendChild(el('p', 'sub', `Puntos disponibles: ${h.skillPoints} · Nivel ${h.level}`));
  const items = [];
  const tree = E.Data.skillTree(h.classId, 60);
  for (const sid of tree) {
    const sk = E.Data.skills[sid];
    if (!sk) continue;
    const rank = h.skills[sid] || 0;
    const can = E.skillAvailable(h, sid) && h.skillPoints > 0;
    items.push({
      label: `${sk.name}${rank ? ' · rango ' + rank : ''}`,
      hint: `${sk.desc} | Nivel requerido: ${sk.tier}`,
      right: can ? 'mejorar' : (h.level < sk.tier ? `nivel ${sk.tier}` : (rank >= sk.max ? 'al máximo' : 'sin puntos')),
      disabled: !can,
      id: sid
    });
  }
  items.push({ label: 'Volver' });
  wrap.appendChild(menuNode(items, i => {
    if (i === items.length - 1) { G.screen = 'character'; G.menu = 0; renderAll(); return; }
    const r = E.learnSkill(h, items[i].id);
    if (r.ok) { G.toast = 'Habilidad mejorada.'; Audio8.mok(); }
    else { G.toast = r.why; Audio8.mno(); }
    renderAll();
  }, {}));
  return wrap;
}

/* -------------------------------- MISIONES ------------------------------ */
function viewQuests() {
  const run = G.run;
  const wrap = el('div', 'questWrap');
  wrap.appendChild(el('h2', 'h2', 'Diario de misiones'));
  const avail = E.availableQuests(run, run.zone);
  const active = E.activeQuests(run);
  const items = [];
  for (const q of avail) items.push({ label: `Aceptar: ${q.name}`, hint: `${q.giver} · ${q.desc}`, right: `+${q.rewards.xp} EXP`, quest: q, act: 'accept' });
  for (const q of active) {
    const p = E.questProgress(run, q);
    const done = E.questComplete(run, q);
    items.push({
      label: `${done ? 'Entregar' : 'En curso'}: ${q.name}`,
      hint: `${q.desc} (${p.have}/${p.need})`,
      right: done ? 'entregar' : `${p.have}/${p.need}`,
      quest: q, act: done ? 'turnin' : 'info'
    });
  }
  if (!items.length) items.push({ label: 'No hay misiones aquí', hint: 'Vuelve a las zonas con aldea', disabled: true });
  items.push({ label: 'Volver' });
  wrap.appendChild(menuNode(items, i => {
    if (i === items.length - 1) { G.screen = 'zone'; G.menu = 0; renderAll(); return; }
    const it = items[i];
    if (!it.quest) return;
    if (it.act === 'accept') {
      const r = E.acceptQuest(run, it.quest.id);
      G.toast = r.ok ? 'Misión aceptada.' : r.why;
      if (r.ok) Audio8.mok(); else Audio8.mno();
    } else if (it.act === 'turnin') {
      const r = E.turnInQuest(run, it.quest.id);
      if (r.ok) {
        G.toast = `Misión completada: +${r.rewards.xp} EXP, +${r.rewards.gold} oro.`;
        Audio8.msfx('levelup');
        autosave();
      } else { G.toast = r.why; Audio8.mno(); }
    } else G.toast = 'Sigue progresando en la zona.';
    renderAll();
  }, {}));

  const completadas = D.QUESTS.filter(q => E.questState(run, q.id).status === 'done');
  if (completadas.length) {
    const box = el('div', 'questDone');
    box.appendChild(el('h3', 'h3', 'Completadas'));
    for (const q of completadas) box.appendChild(el('div', 'questLine', '✓ ' + q.name));
    wrap.appendChild(box);
  }
  return wrap;
}

/* ------------------------------- PERSONAJE ------------------------------ */
function viewCharacter() {
  const run = G.run, h = run.hero;
  const wrap = el('div', 'charWrap');
  const head = el('div', 'viewHead');
  head.appendChild(el('h2', 'h2', h.name));
  head.appendChild(el('p', 'sub', `${E.Data.classes[h.classId].name} · Nivel ${h.level} · ${h.xp} / ${E.xpForLevel(h.level)} EXP`));
  wrap.appendChild(head);
  const cols = el('div', 'charCols');
  const st = el('div', 'charBox');
  st.appendChild(el('h3', 'h3', 'Estadísticas'));
  const stats = E.heroStats(h);
  const rows = [
    ['Fuerza', stats.str], ['Destreza', stats.dex], ['Inteligencia', stats.int],
    ['Constitución', stats.con], ['Sabiduría', stats.wis], ['Suerte', stats.luck],
    ['Vida', h.maxHp], ['Maná', h.maxMp], ['Ataque', E.heroAttack(h)],
    ['Defensa', E.heroDefense(h)], ['Magia', E.heroMagic(h)],
    ['Crítico', Math.round(E.heroCrit(h) * 100) + '%'], ['Evasión', Math.round(E.heroDodge(h) * 100) + '%']
  ];
  for (const [k, v] of rows) {
    const r = el('div', 'statRow');
    r.appendChild(el('span', null, k));
    r.appendChild(el('b', null, String(v)));
    st.appendChild(r);
  }
  cols.appendChild(st);

  const right = el('div', 'charBox');
  right.appendChild(el('h3', 'h3', 'Progreso'));
  const info = [
    ['Oro', h.gold], ['Pociones', h.potions], ['Objetos', h.bag.length],
    ['Combates', run.stats.battles || 0], ['Victorias', run.stats.wins || 0],
    ['Jefes caídos', run.stats.bosses || 0], ['Pasos', run.stats.steps || 0],
    ['Día', run.day]
  ];
  for (const [k, v] of info) {
    const r = el('div', 'statRow');
    r.appendChild(el('span', null, k));
    r.appendChild(el('b', null, String(v)));
    right.appendChild(r);
  }
  const next = E.Data.nextUnlock(h.classId, h.level);
  if (next) {
    right.appendChild(el('h3', 'h3', `Próximo nivel: ${next.level}`));
    for (const sid of next.skills) right.appendChild(el('div', 'questLine', '· ' + E.Data.skills[sid].name));
  }
  cols.appendChild(right);
  wrap.appendChild(cols);

  const st2 = el('div', 'charBox');
  st2.appendChild(el('h3', 'h3', 'Estados'));
  if (!h.statuses.length) st2.appendChild(el('p', 'sub', 'Sin efectos activos.'));
  for (const s of h.statuses) {
    const d = E.Data.statuses[s.id];
    if (d) st2.appendChild(el('div', 'questLine', `${d.name} (${s.turns})`));
  }
  wrap.appendChild(st2);

  wrap.appendChild(menuNode([
    { label: 'Repartir puntos de habilidad', hint: `${h.skillPoints} disponibles` },
    { label: 'Inventario', hint: `${h.bag.length} objetos` },
    { label: 'Volver' }
  ], i => {
    if (i === 0) { G.screen = 'skills'; G.menu = 0; renderAll(); }
    else { G.screen = G.run.dungeon ? 'dungeon' : 'zone'; G.menu = 0; renderAll(); }
  }, {}));
  return wrap;
}

/* -------------------------------- GUARDADO ------------------------------ */
function viewSaves() {
  const wrap = el('div', 'saveWrap');
  wrap.appendChild(el('h2', 'h2', 'Guardar partida'));
  const saves = E.listSaves();
  const items = saves.map((sv, i) => sv
    ? { label: `Ranura ${i + 1}: ${sv.name}`, hint: `Nv ${sv.level} · ${E.Data.zones[sv.zone].name} · ${sv.gold} oro` , right: 'sobrescribir' }
    : { label: `Ranura ${i + 1}: vacía`, hint: 'guardar aquí' });
  items.push({ label: 'Volver', hint: '' });
  wrap.appendChild(menuNode(items, i => {
    if (i === items.length - 1) { G.screen = G.run.dungeon ? 'dungeon' : 'zone'; G.menu = 0; renderAll(); return; }
    const r = E.saveTo(i, G.run);
    G.toast = r.ok ? `Partida guardada en la ranura ${i + 1}.` : r.why;
    Audio8.mok();
    renderAll();
  }, {}));
  const box = el('div', 'charBox');
  box.appendChild(el('h3', 'h3', 'Nota'));
  box.appendChild(el('p', 'sub', 'El juego guarda automáticamente después de cada victoria, misión o mazmorra completada. Esta pantalla sirve para fijar un punto exacto.'));
  wrap.appendChild(box);
  return wrap;
}

function autosave(msg) {
  if (!G.run) return;
  try {
    const keys = E.listSaves();
    let slot = keys.findIndex(s => s && s.name === G.run.hero.name);
    if (slot < 0) slot = 0;
    E.saveTo(slot, G.run);
    if (msg) G.toast = msg;
  } catch (e) {}
}

/* --------------------------- FIN DEL JUEGO ------------------------------ */
function viewGameOver() {
  const wrap = el('div', 'overWrap');
  wrap.appendChild(el('h2', 'h2 bad', 'Has caído'));
  wrap.appendChild(el('p', 'sub', 'Aethel sigue en pie, pero sin ti. La aventura te devuelve al último lugar seguro con la mitad de tu oro.'));
  wrap.appendChild(menuNode([
    { label: 'Seguir desde el último punto seguro', hint: 'Pierdes la mitad del oro' },
    { label: 'Cargar partida guardada' },
    { label: 'Volver al título' }
  ], i => {
    if (i === 0) {
      const h = G.run.hero;
      h.gold = Math.floor(h.gold / 2);
      h.hp = Math.max(1, Math.round(h.maxHp * 0.5));
      h.mp = Math.round(h.maxMp * 0.5);
      h.statuses = [];
      G.toast = 'Despiertas en la aldea, más pobre pero vivo.';
      E.travelTo(G.run, 'aldea_inicio');
      G.screen = 'zone'; G.menu = 0;
      Audio8.mode = 'field';
      autosave();
      renderAll();
    } else if (i === 1) { G.screen = 'load'; G.menu = 0; renderAll(); }
    else { G.run = null; G.screen = 'title'; G.menu = 0; renderAll(); }
  }, {}));
  return wrap;
}

function viewVictory() {
  const wrap = el('div', 'winWrap');
  wrap.appendChild(el('h2', 'h2 good', 'El Vacío se cierra'));
  wrap.appendChild(el('p', 'sub', 'La puerta que abrió el primer rey vuelve a estar cerrada. Aethel respira.'));
  wrap.appendChild(menuNode([{ label: 'Seguir explorando' }, { label: 'Volver al título' }], i => {
    if (i === 0) { G.screen = 'zone'; G.menu = 0; renderAll(); }
    else { G.screen = 'title'; G.menu = 0; renderAll(); }
  }, {}));
  return wrap;
}

/* ------------------------------- TECLADO -------------------------------- */
function countItems() {
  const nodes = document.querySelectorAll('.menu .item:not(.disabled)');
  return nodes.length;
}

function currentList() {
  const s = G.screen;
  return document.querySelectorAll('.menu .item').length;
}

function navigate(delta) {
  const s = G.screen;
  if (s === 'title' || s === 'load' || s === 'saves') { moveMenu(delta, currentList()); return; }
  if (s === 'class') { const n = Object.keys(E.Data.classes).length; G.menu = (G.menu + delta + n) % n; Audio8.mclick(); renderAll(); return; }
  if (s === 'battle') {
    if (G.options) { moveMenu(delta, currentList()); return; }
    const alive = G.battle.enemies.filter(e => e.hp > 0);
    if (!alive.length) return;
    G.target = (G.target + delta + G.battle.enemies.length) % G.battle.enemies.length;
    if (G.battle.enemies[G.target].hp <= 0) G.target = (G.target + delta + G.battle.enemies.length) % G.battle.enemies.length;
    Audio8.mclick();
    renderAll();
    return;
  }
  moveMenu(delta, currentList());
}

function activate() {
  const s = G.screen;
  Audio8.start();
  if (s === 'class') { startNew(Object.keys(E.Data.classes)[G.menu]); return; }
  const sel = document.querySelector('.menu .item.sel') || document.querySelectorAll('.menu .item')[G.menu];
  if (sel) { sel.click(); return; }
  if (G.options) {
    const o = document.querySelector('.subMenu .item.sel');
    if (o) o.click();
  }
}

function goBack() {
  const s = G.screen;
  Audio8.mno();
  if (G.confirm) { G.confirm = null; renderAll(); return; }
  if (G.options) { G.options = null; G.menu = 0; renderAll(); return; }
  if (s === 'class') { G.screen = 'title'; G.menu = 0; }
  else if (s === 'load') { G.screen = 'title'; G.menu = 0; }
  else if (s === 'battle') { G.toast = 'No puedes salir de un combate.'; }
  else if (s === 'title') return;
  else if (s === 'map') { G.screen = 'title'; G.menu = 0; }
  else if (s === 'skills' || s === 'inventory') { G.screen = 'character'; G.menu = 0; }
  else G.screen = G.run && G.run.dungeon ? 'dungeon' : 'zone', G.menu = 0;
  renderAll();
}

/* -------------------------------- ARRANQUE ------------------------------ */
function init() {
  const stage = $('stage');
  stage.addEventListener('click', () => Audio8.start(), { once: true });
  document.addEventListener('pointerdown', () => Audio8.start(), { once: true });

  window.addEventListener('keydown', ev => {
    const k = ev.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 's' || k === 'd') { ev.preventDefault(); navigate(1); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'w' || k === 'a') { ev.preventDefault(); navigate(-1); }
    else if (k === 'Enter' || k === ' ') { ev.preventDefault(); activate(); }
    else if (k === 'Escape' || k === 'Backspace') { ev.preventDefault(); goBack(); }
    else if (k === 'm' || k === 'M') {
      Audio8.musicOn = !Audio8.musicOn;
      if (Audio8.musicGain) Audio8.musicGain.gain.value = Audio8.musicOn ? 0.26 : 0;
      G.toast = Audio8.musicOn ? 'Música activada' : 'Música silenciada';
      renderAll();
    }
    else if (k === 'i' || k === 'I') {
      if (G.screen !== 'battle' && G.screen !== 'title' && G.screen !== 'class') { G.screen = 'inventory'; G.menu = 0; renderAll(); }
    }
    else if (k === 'c' || k === 'C') {
      if (G.screen !== 'battle' && G.screen !== 'title' && G.screen !== 'class') { G.screen = 'character'; G.menu = 0; renderAll(); }
    }
  });
  renderAll();
}

/* ------------------------------- MÚSICA --------------------------------- */
/* Composición mínima por síntesis: bajo, arpegio y percusión, con armonía
   distinta para el mapa, el combate y los jefes.                              */
(function music() {
  const SCALES = {
    field: [0, 3, 5, 7, 10, 12, 15, 17],
    battle: [0, 2, 3, 7, 8, 12, 14, 15],
    boss: [0, 1, 4, 6, 7, 11, 12, 13]
  };
  const ROOTS = { field: 55, battle: 82, boss: 49 };
  const BPM = { field: 88, battle: 132, boss: 108 };

  setInterval(() => {
    if (!Audio8.musicOn || !Audio8.ac) return;
    const mode = Audio8.mode || 'field';
    const step = Audio8.step++;
    const scale = SCALES[mode] || SCALES.field;
    const root = ROOTS[mode] || 55;
    const bpm = BPM[mode] || 88;
    const beat = 60000 / bpm / 4;
    const deg = scale[step % scale.length];
    const oct = (step % 16 < 8) ? 2 : 4;
    const freq = root * Math.pow(2, deg / 12) * (oct / 2 + 0.5);
    // arpegio
    if (step % 2 === 0) Audio8.blip('triangle', freq * 2, 0.16, 0.05);
    // bajo cada compás
    if (step % 8 === 0) Audio8.blip('sine', root * Math.pow(2, scale[0] / 12) / 2, 0.5, 0.09);
    // percusión en combate
    if ((mode === 'battle' || mode === 'boss') && step % 4 === 2) Audio8.noise(0.09, 0.16, 3200);
    // melodía ocasional
    if (step % 32 === 16) {
      for (let i = 0; i < 4; i++) {
        const d = scale[(step + i) % scale.length];
        setTimeout(() => Audio8.blip('square', root * Math.pow(2, d / 12) * 4, 0.2, 0.045), i * 140);
      }
    }
  }, 110);
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

window.AethelGame = { G, renderAll };
})(typeof globalThis !== 'undefined' ? globalThis : this);
