/* =========================================================================
   CRÓNICAS DE AETHEL — Motor del juego
   JavaScript puro, sin dependencias. Funciona en el navegador y en Node.
   Este archivo es puro: no toca el DOM.
   ========================================================================= */
(function (root) {
'use strict';

const E = {};

/* ---------------------------------- RNG --------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RNG = {
  _r: Math.random,
  seed(s) { this._r = mulberry32(s); },
  reset() { this._r = Math.random; },
  next() { return this._r(); },
  int(min, max) { return Math.floor(min + this._r() * (max - min + 1)); },
  float(min, max) { return min + this._r() * (max - min); },
  chance(p) { return this._r() < p; },
  pick(arr) { return arr[Math.floor(this._r() * arr.length)]; },
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e[1];
    let roll = this._r() * total;
    for (const e of entries) { roll -= e[1]; if (roll <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this._r() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
};
E.RNG = RNG;

const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
const round = Math.round;
E.clamp = clamp;

/* ================================ DIARIO ================================= */
E.Log = function () {
  const self = {
    entries: [],
    push(text, kind, extra) {
      const e = { text, kind: kind || 'info' };
      if (extra) for (const k in extra) e[k] = extra[k];
      self.entries.push(e);
      if (self.entries.length > 300) self.entries.splice(0, self.entries.length - 300);
      return e;
    },
    clear() { self.entries.length = 0; },
    last(n) { return self.entries.slice(-n); }
  };
  return self;
};

/* ============================== PERSONAJE ================================ */
E.heroFromClass = function (classId) {
  const c = E.Data.classes[classId];
  const h = {
    id: 'hero',
    name: c.name,
    classId,
    level: 1,
    xp: 0,
    hp: c.hp, maxHp: c.hp,
    mp: c.mp, maxMp: c.mp,
    base: { ...c.base },
    baseHp: c.hp, baseMp: c.mp,
    gold: 60,
    potions: 2,
    skillPoints: 2,
    skills: {},
    gear: { weapon: null, armor: null, head: null, trinket: null },
    bag: [],
    statuses: [],
    defending: false,
    kind: 'hero'
  };
  for (const sid of (c.startSkills || [])) h.skills[sid] = 1;
  return h;
};

/* Estadísticas derivadas ------------------------------------------------ */
E.heroStats = function (h) {
  const s = { str: h.base.str, dex: h.base.dex, int: h.base.int,
              con: h.base.con, wis: h.base.wis, luck: h.base.luck, mag: 0, def: 0, crit: 0, eva: 0, hp: 0, mp: 0 };
  for (const slot of ['weapon', 'armor', 'head', 'trinket']) {
    const item = h.gear[slot];
    if (!item) continue;
    const st = h.gearStats && h.gearStats[slot] ? h.gearStats[slot] : (E.Data.items[item.id] ? E.Data.items[item.id].bonus : null);
    if (st) for (const k in st) s[k] = (s[k] || 0) + st[k];
  }
  return s;
};

E.heroMax = function (h) {
  const s = E.heroStats(h);
  const lv = h.level - 1;
  const maxHp = round(h.baseHp + (s.con - 10) * 5 * (1 + lv * 0.05) + s.hp + h.baseHp * lv * 0.1);
  const maxMp = round(h.baseMp + (s.int - 10) * 4 * (1 + lv * 0.05) + s.mp + h.baseMp * lv * 0.07);
  return { maxHp: Math.max(20, maxHp), maxMp: Math.max(5, maxMp) };
};

E.heroAttack = function (h) {
  const s = E.heroStats(h);
  let atk = 6 + s.str * 2 + s.dex * 0.5 + h.level * 1.5;
  const w = h.gear.weapon ? E.Data.items[h.gear.weapon.id] : null;
  if (w) atk += (s.str * 0.6) + (w.bonus ? (w.bonus.str || 0) * 0.5 : 0);
  return round(atk);
};

E.heroDefense = function (h) {
  const s = E.heroStats(h);
  let def = 3 + s.con * 1.2 + h.level * 1.1 + s.def;
  const a = h.gear.armor ? E.Data.items[h.gear.armor.id] : null;
  if (a && a.bonus) def += (a.bonus.def || 0) * 1.5;
  const hd = h.gear.head ? E.Data.items[h.gear.head.id] : null;
  if (hd && hd.bonus) def += (hd.bonus.def || 0) * 1.5;
  return round(def);
};

E.heroMagic = function (h) {
  const s = E.heroStats(h);
  let mag = 6 + s.int * 2.1 + s.wis * 1.2 + h.level * 1.4;
  if (h.gear.weapon && E.Data.items[h.gear.weapon.id].bonus) mag += (E.Data.items[h.gear.weapon.id].bonus.mag || 0) * 0.7;
  return round(mag);
};

E.heroHealPower = function (h) {
  const s = E.heroStats(h);
  return round(8 + s.wis * 2.4 + s.int * 0.8 + h.level * 1.2);
};

E.heroCrit = function (h) {
  const s = E.heroStats(h);
  return clamp(0.04 + s.luck * 0.006 + s.crit / 100, 0, 0.75);
};

E.heroDodge = function (h) {
  const s = E.heroStats(h);
  return clamp(0.02 + s.dex * 0.004 + s.eva / 100, 0, 0.55);
};

E.recalcHero = function (h) {
  const m = E.heroMax(h);
  h.maxHp = m.maxHp; h.maxMp = m.maxMp;
  h.hp = clamp(h.hp, 0, h.maxHp);
  h.mp = clamp(h.mp, 0, h.maxMp);
  return h;
};

E.xpForLevel = function (level) { return round(45 * Math.pow(level, 1.68)); };

E.gainXp = function (h, amount) {
  const events = [];
  h.xp += amount;
  let guard = 0;
  while (h.xp >= E.xpForLevel(h.level) && h.level < 60 && guard++ < 100) {
    h.xp -= E.xpForLevel(h.level);
    h.level++;
    h.skillPoints++;
    const g = E.Data.classes[h.classId].growth || {};
    h.baseHp = round(h.baseHp * 1.035) + 4;
    h.baseMp = round(h.baseMp * 1.03) + 2;
    for (const k in g) if (RNG.chance(g[k])) h.base[k]++;
    events.push({ type: 'levelUp', level: h.level });
  }
  E.recalcHero(h);
  if (h.hp > 0) h.hp = h.maxHp;
  return events;
};

/* =============================== ENEMIGOS ================================ */
E.makeEnemy = function (typeId, level) {
  const t = E.Data.enemies[typeId];
  const lv = Math.max(1, level || 1);
  const tier = t.tier || 1;
  const k = 1 + (lv - 1) * 0.16 + (tier - 1) * 0.05;
  return {
    id: 'e' + Math.floor(RNG.next() * 1e9),
    kind: 'enemy',
    typeId,
    name: t.name,
    art: t.sprite,
    level: lv,
    hp: round(t.hp * k),
    maxHp: round(t.hp * k),
    atk: round(t.atk * k),
    def: round(t.def * k),
    mag: round((t.mag || t.atk * 0.5) * k),
    xp: round(t.rewards.xp * (1 + (lv - 1) * 0.12)),
    gold: round(t.rewards.gold * (1 + (lv - 1) * 0.1)),
    crit: t.crit / 100,
    dodge: t.eva / 300,
    element: t.element || null,
    weakness: t.weak ? Object.keys(t.weak)[0] : null,
    resist: t.resist ? Object.keys(t.resist)[0] : null,
    traits: (t.tags || []).slice(),
    spell: t.spell || null,
    statuses: [],
    defending: false,
    boss: !!t.boss,
    loot: (t.drops || []).map(d => ({ id: d.item, chance: d.chance }))
  };
};

E.rollEncounter = function (zoneId, partyLevel) {
  const z = E.Data.zones[zoneId];
  if (!z || !z.pool || !z.pool.length) return E.makeEnemy('rata_gigante', partyLevel);
  const id = RNG.weighted(z.pool.map(p => [p.id, p.w]));
  return E.makeEnemy(id, clamp(partyLevel + RNG.int(-1, 1), 1, 60));
};

/* ============================ DAÑO Y COMBATE ============================= */
E.elementMultiplier = function (element, target) {
  if (!element || element === 'neutral') return 1;
  let m = 1;
  if (target.weakness === element) m *= 1.6;
  if (target.resist === element) m *= 0.55;
  return m;
};

E.computeDamage = function (attacker, target, opts) {
  opts = opts || {};
  const power = opts.power == null ? 1 : opts.power;
  const isMagic = !!opts.isMagic;
  let atk;
  if (attacker.kind === 'hero') atk = isMagic ? E.heroMagic(attacker) : E.heroAttack(attacker);
  else atk = isMagic ? attacker.mag : attacker.atk;

  if (E.hasStatus(attacker, 'weaken')) atk *= 0.7;
  if (E.hasStatus(attacker, 'might')) atk *= 1.35;
  if (opts.critBonus) atk *= 1;

  let def = target.kind === 'hero' ? E.heroDefense(target) : target.def;
  if (E.hasStatus(target, 'vulnerable')) def *= 0.65;
  if (E.hasStatus(target, 'guard')) def *= 1.45;
  if (target.defending) def *= 1.8;
  if (opts.ignoreDef) def *= (1 - opts.ignoreDef);

  let dmg = atk * power * 2.2 * (1 - def / (def + 55));
  if (opts.bonus) dmg += opts.bonus;
  dmg *= E.elementMultiplier(opts.element, target);
  dmg *= RNG.float(0.92, 1.08);

  let crit = false;
  const cc = (attacker.kind === 'hero' ? E.heroCrit(attacker) : (attacker.crit || 0.05)) + (opts.critBonus || 0);
  if (RNG.chance(cc)) { dmg *= 1.8; crit = true; }
  return { damage: Math.max(1, round(dmg)), crit };
};

E.hasStatus = function (unit, id) { return unit.statuses.some(s => s.id === id); };
E.getStatus = function (unit, id) { return unit.statuses.find(s => s.id === id) || null; };

E.addStatus = function (unit, id, turns, power) {
  const def = E.Data.statuses[id];
  if (!def) return;
  const cur = E.getStatus(unit, id);
  if (cur) {
    cur.turns = Math.max(cur.turns, turns);
    cur.power = Math.max(cur.power || 0, power || 0);
  } else {
    unit.statuses.push({ id, turns, power: power || 0 });
  }
};

E.tickStatuses = function (unit, log) {
  const out = [];
  for (let i = unit.statuses.length - 1; i >= 0; i--) {
    const st = unit.statuses[i];
    const def = E.Data.statuses[st.id];
    if (def && def.tick) {
      const r = def.tick(unit, st);
      if (r) out.push(r);
    }
    st.turns--;
    if (st.turns <= 0) {
      unit.statuses.splice(i, 1);
      out.push({ text: `${unit.name} deja de sufrir ${def ? def.name.toLowerCase() : st.id}.`, kind: 'status' });
    }
  }
  if (log) for (const o of out) log.push(o.text, o.kind);
  return out;
};

E.applyDamage = function (target, amount, log) {
  target.hp = Math.max(0, target.hp - amount);
  if (target.hp <= 0 && log) log.push(`${target.name} cae derrotado.`, 'down');
  return target.hp;
};

E.heal = function (target, amount, log) {
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  const real = target.hp - before;
  if (log && real > 0) log.push(`${target.name} recupera ${real} de vida.`, 'heal');
  return real;
};

E.basicAttack = function (attacker, target, log) {
  const dodge = target.kind === 'hero' ? E.heroDodge(target) : (target.dodge || 0);
  if (RNG.chance(dodge)) {
    log.push(`${target.name} esquiva el ataque de ${attacker.name}.`, 'dodge');
    return { missed: true, damage: 0 };
  }
  const r = E.computeDamage(attacker, target, { power: 1, element: attacker.element || null });
  E.applyDamage(target, r.damage, log);
  log.push(`${attacker.name} golpea a ${target.name} por ${r.damage}${r.crit ? ' (¡crítico!)' : ''}.`, r.crit ? 'crit' : 'hit');
  return r;
};

/* ============================== HABILIDADES ============================== */
E.skillCost = function (sk, rank) { return round((sk.mp || 0) + (sk.mpPer || 0) * (rank - 1)); };

E.skillAvailable = function (hero, skillId) {
  const sk = E.Data.skills[skillId];
  if (!sk) return false;
  return hero.level >= sk.tier && (hero.skills[skillId] || 0) < sk.max;
};

E.learnSkill = function (hero, skillId) {
  if (hero.skillPoints <= 0) return { ok: false, why: 'Sin puntos de habilidad.' };
  if (!E.skillAvailable(hero, skillId)) return { ok: false, why: 'Requisitos no cumplidos.' };
  hero.skillPoints--;
  hero.skills[skillId] = (hero.skills[skillId] || 0) + 1;
  E.recalcHero(hero);
  return { ok: true, rank: hero.skills[skillId] };
};

E.usableSkills = function (hero) {
  const out = [];
  for (const sid in hero.skills) {
    const sk = E.Data.skills[sid];
    if (!sk || sk.kind === 'passive') continue;
    const cost = E.skillCost(sk, hero.skills[sid]);
    out.push({ id: sid, skill: sk, rank: hero.skills[sid], cost, ready: hero.mp >= cost });
  }
  out.sort((a, b) => a.skill.tier - b.skill.tier || a.skill.name.localeCompare(b.skill.name));
  return out;
};

E.useSkill = function (actor, target, skillId, log, units) {
  const sk = E.Data.skills[skillId];
  if (!sk) return { ok: false, why: 'Habilidad desconocida.' };
  if (E.hasStatus(actor, 'silence')) return { ok: false, why: 'Estás silenciado.' };
  const rank = actor.skills[skillId] || 1;
  const cost = E.skillCost(sk, rank);
  if (actor.kind === 'hero' && actor.mp < cost) return { ok: false, why: 'Maná insuficiente.' };
  if (actor.kind === 'hero') actor.mp -= cost;

  const scaled = (base, per) => (base || 0) + (per || 0) * (rank - 1);
  const magic = actor.kind === 'hero' ? E.heroMagic(actor) : actor.mag;
  const healPower = actor.kind === 'hero' ? E.heroHealPower(actor) : actor.mag;
  const result = { ok: true, cost, hits: [] };

  if (sk.kind === 'damage' || sk.kind === 'drain') {
    const hits = sk.hits || 1;
    for (let i = 0; i < hits; i++) {
      if (target.hp <= 0) break;
      const r = E.computeDamage(actor, target, {
        power: sk.power, isMagic: sk.scale === 'magic', element: sk.element,
        critBonus: sk.critBonus || 0
      });
      E.applyDamage(target, r.damage, log);
      log.push(`${actor.name} usa ${sk.name} sobre ${target.name}: ${r.damage}${r.crit ? ' (¡crítico!)' : ''}.`, r.crit ? 'crit' : 'skill');
      result.hits.push(r.damage);
      if (sk.drain) E.heal(actor, round(r.damage * sk.drain), log);
      if (sk.apply) for (const a of sk.apply) {
        if (RNG.chance(a.chance == null ? 1 : a.chance)) {
          E.addStatus(target, a.id, a.turns, a.power);
          log.push(`${target.name} sufre ${E.Data.statuses[a.id].name}.`, 'status');
        }
      }
    }
  } else if (sk.kind === 'aoe') {
    const targets = (units || []).filter(u => u.hp > 0 && u.kind !== actor.kind);
    for (const t of targets) {
      const r = E.computeDamage(actor, t, { power: sk.power, isMagic: sk.scale === 'magic', element: sk.element });
      E.applyDamage(t, r.damage, log);
      log.push(`${sk.name} alcanza a ${t.name}: ${r.damage}.`, 'skill');
      if (sk.apply) for (const a of sk.apply) {
        if (RNG.chance(a.chance == null ? 1 : a.chance)) E.addStatus(t, a.id, a.turns, a.power);
      }
      result.hits.push(r.damage);
    }
    if (!targets.length) return { ok: false, why: 'No hay enemigos.' };
  } else if (sk.kind === 'heal') {
    const amount = round(healPower * sk.power + (sk.healFlat ? actor.maxHp * sk.healFlat : 0));
    E.heal(actor, amount, log);
    log.push(`${actor.name} usa ${sk.name} y recupera ${amount}.`, 'heal');
    if (sk.cleanse) {
      actor.statuses = actor.statuses.filter(s => !E.Data.statuses[s.id] || !E.Data.statuses[s.id].bad);
      log.push(`${actor.name} limpia sus efectos negativos.`, 'buff');
    }
    if (sk.apply) for (const a of sk.apply) if (RNG.chance(a.chance == null ? 1 : a.chance)) E.addStatus(actor, a.id, a.turns, a.power);
  } else if (sk.kind === 'cleanse') {
    const before = actor.statuses.length;
    actor.statuses = actor.statuses.filter(s => !E.Data.statuses[s.id] || !E.Data.statuses[s.id].bad);
    log.push(`${actor.name} se libera de ${before - actor.statuses.length} efectos.`, 'buff');
  } else if (sk.kind === 'buff') {
    if (sk.apply) for (const a of sk.apply) {
      E.addStatus(actor, a.id, a.turns, a.power);
      log.push(`${actor.name} recibe ${E.Data.statuses[a.id].name}.`, 'buff');
    }
  }
  return result;
};

E.usableSkills; 

/* ======================================================================== */
/*                             COMBATE                                      */
/* ======================================================================== */
E.startBattle = function (hero, enemies, opts) {
  opts = opts || {};
  const battle = {
    hero, enemies,
    units: [hero].concat(enemies),
    round: 1,
    order: [],
    turnIndex: 0,
    active: null,
    log: E.Log(),
    over: false,
    result: null,
    rewards: null,
    kind: opts.kind || 'normal',
    title: opts.title || 'Emboscada',
    zone: opts.zone || null,
    playerTurn: false
  };
  battle.log.push(`${battle.title}: ${enemies.length === 1 ? enemies[0].name : enemies.length + ' enemigos'} bloquean el paso.`, 'phase');
  E.rollInitiative(battle);
  return battle;
};

E.initiative = function (u) {
  if (u.kind === 'hero') return E.heroStats(u).dex * 1.4 + u.level * 0.4;
  return 8 + (u.level || 1) * 0.4;
};

E.rollInitiative = function (battle) {
  battle.order = battle.units.filter(u => u.hp > 0)
    .map(u => ({ u, r: E.initiative(u) + RNG.float(0, 4) }))
    .sort((a, b) => b.r - a.r)
    .map(x => x.u);
  battle.turnIndex = 0;
  battle.active = battle.order[0] || null;
  battle.playerTurn = battle.active && battle.active.kind === 'hero';
  return battle.order;
};

E.nextTurn = function (battle) {
  if (battle.over) return { over: true };
  if (battle.enemies.every(e => e.hp <= 0)) return E.finishBattle(battle, 'win');
  if (battle.hero.hp <= 0) return E.finishBattle(battle, 'lose');

  const finished = battle.active;
  if (finished && finished.hp > 0) {
    if (E.hasStatus(finished, 'stun')) {
      finished.statuses = finished.statuses.filter(s => s.id !== 'stun');
      battle.log.push(`${finished.name} se recupera del aturdimiento.`, 'status');
    }
    // regeneración de enemigos con la marca correspondiente
    const base = E.Data.enemies[finished.typeId];
    if (base && base.regenTurn) {
      E.heal(finished, round(finished.maxHp * base.regenTurn), battle.log);
    }
    E.tickStatuses(finished, battle.log);
    finished.defending = false;
  }

  battle.turnIndex++;
  if (battle.turnIndex >= battle.order.length) {
    battle.round++;
    battle.log.push(`— Ronda ${battle.round} —`, 'phase');
    E.rollInitiative(battle);
  }
  let guard = 0;
  while (battle.turnIndex < battle.order.length && battle.order[battle.turnIndex].hp <= 0 && guard++ < 60) battle.turnIndex++;
  if (battle.turnIndex >= battle.order.length) E.rollInitiative(battle);
  battle.active = battle.order[battle.turnIndex] || null;
  battle.playerTurn = !!(battle.active && battle.active.kind === 'hero');
  if (battle.enemies.every(e => e.hp <= 0)) return E.finishBattle(battle, 'win');
  if (battle.hero.hp <= 0) return E.finishBattle(battle, 'lose');
  return { over: false, active: battle.active, playerTurn: battle.playerTurn };
};

E.finishBattle = function (battle, result) {
  if (battle.over) return { over: true, result: battle.result };
  battle.over = true;
  battle.result = result;
  const hero = battle.hero;
  if (result === 'win') {
    let xp = 0, gold = 0;
    const drops = [];
    for (const e of battle.enemies) {
      xp += e.xp; gold += e.gold;
      for (const l of e.loot) if (RNG.chance(l.chance)) drops.push(l.id);
      if (typeof E.noteKill === 'function') E.noteKill(battle.run || null, e);
    }
    hero.gold += gold;
    const events = E.gainXp(hero, xp);
    battle.rewards = { xp, gold, drops, events };
    battle.log.push(`Victoria: +${xp} EXP, +${gold} oro.`, 'reward');
    for (const d of drops) {
      const it = E.Data.items[d];
      if (!it) continue;
      if (d === 'pocion_menor') hero.potions++;
      else hero.bag.push(E.newItem(d));
      battle.log.push(`Consigues: ${it.name}.`, 'reward');
    }
    for (const ev of events) battle.log.push(`Subes al nivel ${ev.level}.`, 'levelup');
  } else if (result === 'lose') {
    battle.log.push('Has caído. La aventura te devuelve al último lugar seguro.', 'down');
  } else if (result === 'flee') {
    battle.log.push('Escapas del combate.', 'warn');
  }
  return { over: true, result };
};

/* Acción del héroe, ya decidida por la interfaz -------------------------- */
E.heroAction = function (battle, action) {
  const hero = battle.hero, log = battle.log;
  if (!hero || hero.hp <= 0) return { ok: false, why: 'Estás derrotado.' };
  if (E.hasStatus(hero, 'stun')) {
    log.push(`${hero.name} está aturdido y pierde el turno.`, 'status');
    return { ok: true, skipped: true };
  }
  switch (action.type) {
    case 'attack': {
      const t = E.pickTarget(battle, action.targetId);
      if (!t) return { ok: false, why: 'Objetivo no válido.' };
      E.basicAttack(hero, t, log);
      return { ok: true };
    }
    case 'skill': {
      const sk = E.Data.skills[action.skillId];
      let t;
      if (!sk) return { ok: false, why: 'Habilidad desconocida.' };
      if (sk.target === 'self' || sk.kind === 'buff' || sk.kind === 'heal' || sk.kind === 'cleanse') t = hero;
      else if (sk.target === 'allEnemies' || sk.kind === 'aoe') t = E.pickTarget(battle, null);
      else t = E.pickTarget(battle, action.targetId);
      if (!t) return { ok: false, why: 'Objetivo no válido.' };
      return E.useSkill(hero, t, action.skillId, log, battle.units);
    }
    case 'item': {
      if (action.uid) return E.useBagItem(hero, action.uid, true, log, battle);
      return E.usePotion(hero, log);
    }
    case 'defend':
      hero.defending = true;
      log.push(`${hero.name} se pone en guardia.`, 'buff');
      return { ok: true };
    case 'flee': {
      if (battle.kind === 'boss') { log.push('No puedes huir de este combate.', 'warn'); return { ok: false, why: 'No puedes huir de un jefe.' }; }
      if (RNG.chance(clamp(0.5 + E.heroDodge(hero) * 0.4, 0.25, 0.9))) {
        E.finishBattle(battle, 'flee');
        return { ok: true, fled: true };
      }
      log.push('No consigues escapar.', 'warn');
      return { ok: true, fled: false };
    }
    default: return { ok: false, why: 'Acción desconocida.' };
  }
};

E.pickTarget = function (battle, id) {
  let u;
  if (id) u = battle.units.find(x => x.id === id);
  if (!u) u = battle.enemies.find(x => x.hp > 0);
  return u && u.hp > 0 ? u : (battle.enemies.find(x => x.hp > 0) || null);
};

/* Turno del enemigo ------------------------------------------------------ */
E.enemyTurn = function (battle, enemyId) {
  const e = battle.enemies.find(x => x.id === enemyId) || battle.active;
  if (!e || e.hp <= 0) return { skipped: true };
  const hero = battle.hero, log = battle.log;
  if (E.hasStatus(e, 'stun')) {
    log.push(`${e.name} está aturdido y pierde el turno.`, 'status');
    return { skipped: true };
  }
  const base = E.Data.enemies[e.typeId];
  const low = e.hp / e.maxHp < 0.35;

  // Curación
  const healSkill = (base.skills || []).find(s => s.healSelf);
  if (healSkill && low && RNG.chance(0.55)) {
    const amount = round(e.maxHp * healSkill.healSelf);
    E.heal(e, amount, log);
    log.push(`${e.name} se cura ${amount}.`, 'heal');
    return { action: 'heal' };
  }
  // Hechizo
  if (base.spell && RNG.chance(0.45)) {
    const sp = base.spell;
    const r = E.computeDamage(e, hero, { power: sp.power, isMagic: true, element: sp.element });
    E.applyDamage(hero, r.damage, log);
    log.push(`${e.name} lanza ${sp.name} sobre ${hero.name}: ${r.damage}.`, 'skill');
    if (sp.status && RNG.chance(sp.status.chance == null ? 1 : sp.status.chance)) {
      E.addStatus(hero, sp.status.id, sp.status.turns, sp.status.power);
      log.push(`${hero.name} sufre ${E.Data.statuses[sp.status.id].name}.`, 'status');
    }
    return { action: 'spell', damage: r.damage };
  }
  // Defensa
  if (low && RNG.chance(0.3) && (base.tags || []).indexOf('construct') < 0) {
    e.defending = true;
    log.push(`${e.name} se protege.`, 'buff');
    return { action: 'defend' };
  }
  const r = E.basicAttack(e, hero, log);
  return { action: 'attack', missed: r.missed, damage: r.damage, crit: r.crit };
};

/* Combate automático: se usa en las pruebas y en el modo rápido ---------- */
E.autoBattle = function (battle, policy) {
  policy = policy || 'balanced';
  let guard = 0;
  while (!battle.over && guard++ < 800) {
    const u = battle.active;
    if (!u || u.hp <= 0) { E.nextTurn(battle); continue; }
    if (u.kind === 'hero') {
      const hero = u;
      let acted = false;
      if (hero.hp / hero.maxHp < 0.35 && hero.potions > 0) acted = E.heroAction(battle, { type: 'item' }).ok;
      if (!acted) {
        const opts = E.usableSkills(hero).filter(s => s.ready && s.skill.kind !== 'buff');
        if (opts.length && RNG.chance(policy === 'aggressive' ? 0.8 : 0.55)) {
          const pick = RNG.pick(opts);
          const r = E.heroAction(battle, { type: 'skill', skillId: pick.id, targetId: null });
          acted = r.ok !== false;
        }
      }
      if (!acted) E.heroAction(battle, { type: 'attack', targetId: null });
    } else {
      E.enemyTurn(battle, u.id);
    }
    if (battle.over) break;
    E.nextTurn(battle);
  }
  if (!battle.over) E.finishBattle(battle, 'draw');
  return battle;
};

/* ============================ INVENTARIO ================================ */
E.newItem = function (id) { return { id, uid: 'i' + Math.floor(RNG.next() * 1e9) }; };

E.itemPrice = function (id, sell) {
  const it = E.Data.items[id];
  if (!it) return 0;
  return sell ? Math.max(1, round(it.price * 0.4)) : it.price;
};

E.buy = function (hero, id) {
  const it = E.Data.items[id];
  if (!it) return { ok: false, why: 'Objeto inexistente.' };
  if (hero.gold < it.price) return { ok: false, why: 'No tienes oro suficiente.' };
  hero.gold -= it.price;
  if (id === 'pocion_menor') hero.potions++;
  else hero.bag.push(E.newItem(id));
  return { ok: true };
};

E.sell = function (hero, uid) {
  const i = hero.bag.findIndex(x => x.uid === uid);
  if (i < 0) return { ok: false, why: 'No llevas ese objeto.' };
  const value = E.itemPrice(hero.bag[i].id, true);
  hero.gold += value;
  hero.bag.splice(i, 1);
  return { ok: true, value };
};

E.equip = function (hero, uid) {
  const i = hero.bag.findIndex(x => x.uid === uid);
  if (i < 0) return { ok: false, why: 'No llevas ese objeto.' };
  const item = hero.bag[i];
  const def = E.Data.items[item.id];
  if (!def || !def.slot) return { ok: false, why: 'No se puede equipar.' };
  const slot = def.slot === 'acc1' ? 'trinket' : def.slot;
  const prev = hero.gear[slot];
  hero.gear[slot] = item;
  hero.bag.splice(i, 1);
  if (prev) hero.bag.push(prev);
  E.recalcHero(hero);
  return { ok: true, slot };
};

E.unequip = function (hero, slot) {
  if (!hero.gear[slot]) return { ok: false, why: 'Nada equipado.' };
  hero.bag.push(hero.gear[slot]);
  hero.gear[slot] = null;
  E.recalcHero(hero);
  return { ok: true };
};

E.usePotion = function (hero, log) {
  if (hero.potions <= 0) return { ok: false, why: 'No te quedan pociones.' };
  hero.potions--;
  const amount = E.heal(hero, round(hero.maxHp * 0.4) + 15, log);
  if (log) log.push(`${hero.name} bebe una poción (+${amount}).`, 'item');
  return { ok: true, amount };
};

E.useBagItem = function (hero, uid, inCombat, log, battle) {
  const i = hero.bag.findIndex(x => x.uid === uid);
  if (i < 0) return { ok: false, why: 'No llevas ese objeto.' };
  const item = hero.bag[i];
  const def = E.Data.items[item.id];
  if (!def || def.kind !== 'consumable') return { ok: false, why: 'No es consumible.' };
  const eff = def.effect || {};
  if (eff.heal) E.heal(hero, eff.heal, log);
  if (eff.healPct) E.heal(hero, round(hero.maxHp * eff.healPct), log);
  if (eff.healFull) E.heal(hero, hero.maxHp, log);
  if (eff.mp) hero.mp = Math.min(hero.maxMp, hero.mp + eff.mp);
  if (eff.mpPct) hero.mp = Math.min(hero.maxMp, hero.mp + round(hero.maxMp * eff.mpPct));
  if (eff.cleanse) hero.statuses = hero.statuses.filter(s => !E.Data.statuses[s.id] || !E.Data.statuses[s.id].bad);
  if (eff.status) for (const a of eff.status) {
    const targets = eff.all && battle ? battle.enemies.filter(e => e.hp > 0) : [hero];
    for (const t of targets) E.addStatus(t, a.id, a.turns, a.power);
  }
  if (eff.damage && battle) {
    const targets = eff.all ? battle.enemies.filter(e => e.hp > 0) : [E.pickTarget(battle, null)].filter(Boolean);
    for (const t of targets) {
      const dmg = round(eff.damage * (1 + hero.level * 0.05));
      E.applyDamage(t, dmg, log);
      log.push(`La ${def.name} golpea a ${t.name}: ${dmg}.`, 'item');
    }
  }
  hero.bag.splice(i, 1);
  if (log) log.push(`${hero.name} usa ${def.name}.`, 'item');
  return { ok: true };
};

/* ============================= EXPLORACIÓN ============================== */
E.newRun = function (classId, name) {
  const hero = E.heroFromClass(classId);
  E.recalcHero(hero);
  hero.hp = hero.maxHp; hero.mp = hero.maxMp;
  hero.bag = [E.newItem('pocion_menor')];
  const run = {
    hero,
    name: name || hero.name,
    zone: 'aldea_inicio',
    visited: { aldea_inicio: true },
    flags: {},
    step: 0,
    day: 1,
    story: [],
    questLog: {},
    stock: {},
    log: E.Log(),
    stats: { kills: 0, battles: 0, steps: 0, bosses: 0, wins: 0 },
    finished: false,
    dungeon: null
  };
  E.initStock(run, 'aldea_inicio');
  run.log.push(`${hero.name} comienza su viaje en la Aldea de Robledal.`, 'phase');
  return run;
};

E.initStock = function (run, zoneId) {
  const z = E.Data.zones[zoneId];
  const stock = {};
  if (z && z.shop) for (const id of z.shop) stock[id] = (E.Data.items[id] && E.Data.items[id].stock) || 5;
  run.stock = stock;
  return stock;
};

E.canTravel = function (run, zoneId) {
  const z = E.Data.zones[zoneId];
  if (!z) return { ok: false, why: 'Zona desconocida.' };
  if (run.hero.level < (z.reqLevel || 1)) return { ok: false, why: `Necesitas nivel ${z.reqLevel}.` };
  if (z.unlock && !run.flags[z.unlock]) return { ok: false, why: 'El camino está cerrado por ahora.' };
  return { ok: true };
};

E.travelTo = function (run, zoneId) {
  const can = E.canTravel(run, zoneId);
  if (!can.ok) return can;
  run.zone = zoneId;
  run.visited[zoneId] = true;
  if (E.Data.zones[zoneId].safe) E.initStock(run, zoneId);
  run.log.push(`Viajas a ${E.Data.zones[zoneId].name}.`, 'phase');
  return { ok: true, zone: zoneId };
};

E.exploreStep = function (run) {
  const z = E.Data.zones[run.zone];
  run.step++;
  run.stats.steps++;
  const roll = RNG.next();
  if (!z.safe && roll < z.encounter) {
    const n = RNG.chance(0.28) ? 2 : 1;
    const list = [];
    for (let i = 0; i < n; i++) list.push(E.rollEncounter(run.zone, run.hero.level));
    run.stats.battles++;
    return { type: 'battle', enemies: list, title: `Emboscada en ${z.name}` };
  }
  if (!z.safe && z.loot && z.loot.length && roll < z.encounter + 0.14) {
    const id = RNG.weighted(z.loot.map(l => [l.id, l.w]));
    const it = E.Data.items[id];
    if (!it) return { type: 'nothing' };
    if (id === 'pocion_menor') run.hero.potions++;
    else run.hero.bag.push(E.newItem(id));
    run.log.push(`Encuentras ${it.name}.`, 'reward');
    return { type: 'loot', item: id };
  }
  if (roll < 0.34) {
    const g = RNG.int(5 + run.hero.level * 2, 16 + run.hero.level * 5);
    run.hero.gold += g;
    run.log.push(`Recoges ${g} monedas.`, 'reward');
    return { type: 'gold', amount: g };
  }
  const text = RNG.pick(z.flavor || ['El camino sigue.']);
  run.log.push(text, 'info');
  return { type: 'nothing', text };
};

/* --------------------------- MAZMORRAS ---------------------------------- */
E.generateDungeon = function (zoneId, depth, heroLevel) {
  const z = E.Data.zones[zoneId];
  const rooms = 7 + depth * 2;
  const dungeon = {
    id: 'd' + Math.floor(RNG.next() * 1e9),
    zone: zoneId,
    depth,
    name: `${z.dungeonPrefix || 'Mazmorra'} — Nivel ${depth}`,
    theme: z.theme,
    rooms: [],
    current: 0,
    cleared: false
  };
  for (let i = 0; i < rooms; i++) {
    let type = 'combat';
    if (i === 0) type = 'entrance';
    else if (i === rooms - 1) type = 'boss';
    else if (RNG.chance(0.16)) type = 'treasure';
    else if (RNG.chance(0.13)) type = 'rest';
    const room = { index: i, type, cleared: false, data: null };
    if (type === 'combat') {
      const n = RNG.int(1, Math.min(3, 2 + Math.floor(depth * 0.5)));
      const list = [];
      for (let k = 0; k < n; k++) list.push(E.rollEncounter(zoneId, heroLevel + depth));
      room.data = { enemies: list, title: `Sala ${i + 1} de ${dungeon.name}` };
    } else if (type === 'treasure') {
      const id = z.dungeonLoot && z.dungeonLoot.length ? RNG.weighted(z.dungeonLoot.map(l => [l.id, l.w])) : 'pocion_menor';
      room.data = { item: id, gold: RNG.int(15 * depth, 45 * depth) };
    } else if (type === 'rest') {
      room.data = { heal: 0.3 };
    } else if (type === 'boss') {
      const bossId = (z.bosses && z.bosses.length) ? RNG.pick(z.bosses) : 'rey_goblins';
      room.data = { enemies: [E.makeEnemy(bossId, heroLevel + depth + 1)], title: `${E.Data.enemies[bossId].name}`, boss: true };
    } else {
      room.data = {};
    }
    dungeon.rooms.push(room);
  }
  return dungeon;
};

E.enterDungeon = function (run) {
  const z = E.Data.zones[run.zone];
  if (!z || !z.dungeon) return { ok: false, why: 'Aquí no hay mazmorra.' };
  const depth = 1 + Math.floor(run.stats.bosses / 2);
  run.dungeon = E.generateDungeon(run.zone, depth, run.hero.level);
  run.log.push(`Entras en ${run.dungeon.name}: ${run.dungeon.rooms.length} salas.`, 'phase');
  return { ok: true, dungeon: run.dungeon };
};

E.dungeonRoom = function (run) {
  if (!run.dungeon) return null;
  return run.dungeon.rooms[run.dungeon.current];
};

E.advanceDungeon = function (run) {
  const d = run.dungeon;
  if (!d) return { ok: false, why: 'Sin mazmorra.' };
  const room = d.rooms[d.current];
  if (room && room.type !== 'entrance') room.cleared = true;
  if (d.current + 1 >= d.rooms.length) {
    d.cleared = true;
    run.stats.bosses++;
    run.flags['dungeon_' + d.zone + '_' + d.depth] = true;
    run.log.push(`${d.name} completada.`, 'phase');
    return { ok: true, done: true };
  }
  d.current++;
  return { ok: true, done: false, room: d.rooms[d.current] };
};

E.leaveDungeon = function (run) { run.dungeon = null; return { ok: true }; };

E.restAtInn = function (run) {
  const z = E.Data.zones[run.zone];
  const cost = (z && z.innCost) || 20;
  if (run.hero.gold < cost) return { ok: false, why: 'No puedes pagar la posada.' };
  run.hero.gold -= cost;
  run.hero.hp = run.hero.maxHp;
  run.hero.mp = run.hero.maxMp;
  run.hero.statuses = [];
  run.day++;
  run.log.push(`Descansas en la posada. Día ${run.day}.`, 'phase');
  return { ok: true, cost };
};

/* ============================== GUARDADO ================================ */
const SAVE_VERSION = 3;
E.SAVE_KEY = 'cronicas-de-aethel:v' + SAVE_VERSION;

E.serialize = function (run) {
  return {
    v: SAVE_VERSION,
    t: Date.now(),
    run: {
      name: run.name,
      zone: run.zone,
      visited: run.visited,
      flags: run.flags,
      step: run.step,
      day: run.day,
      story: run.story,
      questLog: run.questLog,
      stock: run.stock,
      stats: run.stats,
      finished: run.finished,
      hero: {
        name: run.hero.name, classId: run.hero.classId, level: run.hero.level,
        xp: run.hero.xp, hp: run.hero.hp, mp: run.hero.mp,
        base: run.hero.base, baseHp: run.hero.baseHp, baseMp: run.hero.baseMp,
        gold: run.hero.gold, potions: run.hero.potions, skillPoints: run.hero.skillPoints,
        skills: run.hero.skills, gear: run.hero.gear, bag: run.hero.bag
      }
    }
  };
};

E.stringifySave = function (run) {
  const code = E.serialize(run);
  const json = JSON.stringify(code);
  try {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(json)));
  } catch (e) {}
  return json;
};

E.parseSave = function (text) {
  let raw = text;
  try {
    if (typeof atob === 'function' && !/^\s*\{/.test(raw)) raw = decodeURIComponent(escape(atob(raw)));
  } catch (e) { /* se asume JSON plano */ }
  const code = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!code || !code.run || !code.run.hero) throw new Error('Partida corrupta.');
  if (code.v !== SAVE_VERSION) throw new Error('Versión incompatible.');
  const h = code.run.hero;
  const hero = E.heroFromClass(h.classId);
  Object.assign(hero, {
    name: h.name, level: h.level, xp: h.xp, base: h.base,
    baseHp: h.baseHp, baseMp: h.baseMp, gold: h.gold, potions: h.potions,
    skillPoints: h.skillPoints, skills: h.skills || {},
    gear: h.gear || hero.gear, bag: h.bag || [], statuses: []
  });
  E.recalcHero(hero);
  hero.hp = clamp(h.hp, 1, hero.maxHp);
  hero.mp = clamp(h.mp, 0, hero.maxMp);
  const run = {
    hero,
    name: code.run.name || hero.name,
    zone: code.run.zone || 'aldea_inicio',
    visited: code.run.visited || {}, flags: code.run.flags || {},
    step: code.run.step || 0, day: code.run.day || 1,
    story: code.run.story || [], questLog: code.run.questLog || {},
    stock: code.run.stock || {},
    stats: code.run.stats || { kills: 0, battles: 0, steps: 0, bosses: 0, wins: 0 },
    finished: !!code.run.finished,
    dungeon: null,
    log: E.Log()
  };
  E.initStock(run, run.zone);
  return run;
};

E.saveTo = function (slot, run) {
  try { localStorage.setItem(E.SAVE_KEY + ':' + slot, E.stringifySave(run)); return { ok: true }; }
  catch (e) { return { ok: false, why: 'No se pudo guardar.' }; }
};

E.loadFrom = function (slot) {
  try {
    const raw = localStorage.getItem(E.SAVE_KEY + ':' + slot);
    if (!raw) return null;
    return E.parseSave(raw);
  } catch (e) { return null; }
};

E.listSaves = function () {
  const out = [];
  for (let i = 0; i < 3; i++) {
    try {
      const raw = localStorage.getItem(E.SAVE_KEY + ':' + i);
      if (!raw) { out.push(null); continue; }
      const code = E.parseSave(raw);
      out.push({ slot: i, name: code.name, level: code.hero.level, zone: code.zone, gold: code.hero.gold, day: code.day });
    } catch (e) { out.push(null); }
  }
  return out;
};

E.deleteSave = function (slot) {
  try { localStorage.removeItem(E.SAVE_KEY + ':' + slot); return true; } catch (e) { return false; }
};

E.version = '1.0.0';
root.AethelEngine = E;
if (typeof module !== 'undefined' && module.exports) module.exports = E;

})(typeof globalThis !== 'undefined' ? globalThis : this);
