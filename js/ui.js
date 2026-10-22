/* =========================================================================
   CRÓNICAS DE AETHEL — Adaptador de datos y lógica de contenido
   Enlaza los datos declarativos con el motor, traduce sus efectos al formato
   que esperan las fórmulas y añade misiones, botín con rareza y comercio.
   No toca el DOM: la capa visual vive en ui-render.js.
   ========================================================================= */
(function (root) {
'use strict';

const E = root.AethelEngine;
const D = root.AETH;

/* ------------------- Normalización de la capa de datos ------------------ */
E.Data = D;
E.Data.classes = D.CLASSES;
E.Data.items = D.ITEMS;
E.Data.skills = D.SKILLS;
E.Data.enemies = D.ENEMIES;
E.Data.zones = D.ZONES;
E.Data.statuses = D.STATUS;
E.Data.quests = D.QUESTS;
E.Data.rarity = D.RARITY;
E.Data.affixes = D.AFFIXES;
E.Data.elements = D.ELEMENTS;

/* Clases: el motor espera las seis estadísticas primarias en `base`. */
for (const cid in D.CLASSES) {
  const c = D.CLASSES[cid];
  if (c.__ready) continue;
  c.startSkills = (D.SKILL_TREE[cid] && D.SKILL_TREE[cid][1]) ? D.SKILL_TREE[cid][1].slice(0, 3) : [];
  c.__ready = true;
}

/* Habilidades: traducción de los efectos declarativos al formato del motor. */
for (const sid in D.SKILLS) {
  const s = D.SKILLS[sid];
  if (s.__ready) continue;
  s.mp = s.cost;
  s.mpPer = Math.round((s.cost || 0) * 0.18);
  s.max = 5;
  s.tier = s.tier || 1;
  if (s.element === 'neutral') s.element = null;
  switch (s.target) {
    case 'allEnemies': s.kind = 'aoe'; break;
    case 'self':
      if (s.scale === 'heal') s.kind = 'heal';
      else if (s.cleanse && !s.apply) s.kind = 'cleanse';
      else s.kind = s.power ? 'damage' : 'buff';
      break;
    default:
      s.kind = 'damage';
  }
  if (s.target === 'self' && s.power && s.scale !== 'heal') s.kind = 'damage';
  s.__ready = true;
}

/* Estados: el motor espera un efecto por turno en def.tick. */
for (const stid in D.STATUS) {
  const st = D.STATUS[stid];
  if (st.__ready) continue;
  st.bad = st.kind === 'debuff' || st.kind === 'dot' || st.kind === 'control';
  st.tick = function (unit) {
    if (st.kind === 'dot') {
      let dmg;
      if (st.dmg === 'maxhp') dmg = Math.max(1, Math.round(unit.maxHp * st.ratio));
      else if (st.dmg === 'atk') dmg = Math.max(1, Math.round((unit.atk || 6) * st.ratio));
      else dmg = st.power || 6;
      E.applyDamage(unit, dmg, null);
      return { text: `${unit.name} sufre ${st.name} (${dmg}).`, kind: 'dot' };
    }
    if (st.healRatio) {
      const h = Math.round(unit.maxHp * st.healRatio);
      E.heal(unit, h, null);
      return { text: `${unit.name} regenera ${h}.`, kind: 'heal' };
    }
    return null;
  };
  st.__ready = true;
}

/* Objetos: se expone el afijo como `bonus` para las fórmulas del motor. */
for (const iid in D.ITEMS) {
  const it = D.ITEMS[iid];
  if (it.__ready) continue;
  it.__ready = true;
}

/* Enemigos: rasgos de comportamiento y hechizo principal. */
for (const eid in D.ENEMIES) {
  const e = D.ENEMIES[eid];
  if (e.__ready) continue;
  if (!e.spell) {
    const sp = (e.skills || []).find(s => s.element || s.drain || (s.apply && !s.self));
    if (sp) {
      e.spell = {
        name: String(sp.id).split('_').join(' '),
        power: sp.power || 1.3,
        element: sp.element && sp.element !== 'neutral' ? sp.element : null,
        status: sp.apply && sp.apply.length ? { id: sp.apply[0].id, turns: sp.apply[0].turns, chance: sp.apply[0].chance } : null
      };
    }
  }
  e.__ready = true;
}

/* Zonas: se completa la información que necesita el motor. */
const ZONE_EXTRA = {
  bosque_umbrio: {
    theme: 'raíces y bestias', dungeonPrefix: 'Cripta bajo las raíces',
    flavor: ['Un arroyo corta el sendero. Bebes y sigues.', 'Algo grande se mueve lejos. No lo es.',
             'Las copas crujen sin viento.', 'Un árbol marcado con un símbolo antiguo.'],
    loot: [['pocion_menor',22],['pan_viajero',16],['colmillo',18],['seda_sombria',10],['antidoto',8],['tunica_lino',8],['daga_oxidada',6],['espada_corta',6],['amuleto_hueso',4],['hierba_regen',2]],
    dungeonLoot: [['pocion_menor',24],['cuero_endurecido',10],['cristal_arcano',8],['pendiente_plata',6],['pocion_mayor',5],['anillo_vitalidad',2]],
    dungeon: true
  },
  ruinas_qarim: {
    theme: 'piedra y hueso', dungeonPrefix: 'Catacumbas de Qarim',
    flavor: ['Una columna caída bloquea media calle.', 'Ecos de pasos que no son los tuyos.',
             'Inscripciones que se borran si las miras fijo.', 'Un reloj de sol roto marca una hora imposible.'],
    loot: [['pocion_menor',18],['reliquia_rota',14],['cristal_arcano',12],['ether',10],['pocion_mayor',8],['cota_malla',5],['yelmo_hierro',5],['daga_sombria',4],['espada_corta',6],['antidoto',8]],
    dungeonLoot: [['cristal_arcano',16],['pocion_mayor',12],['diadema_arcana',6],['amuleto_critico',4],['colgante_runico',4],['reliquia_rota',12]],
    dungeon: true
  },
  cienaga_podrida: {
    theme: 'barro y veneno', dungeonPrefix: 'Túmulo sumergido',
    flavor: ['El agua está tibia y no debería.', 'Una barca vacía se mece sola.',
             'Burbujas suben en fila.', 'Un árbol muerto con marcas de dientes.'],
    loot: [['pocion_mayor',20],['antidoto',16],['hierba_regen',12],['ether',12],['reliquia_rota',12],['seda_sombria',10],['cristal_arcano',8],['tunica_arcana',4],['colgante_runico',3]],
    dungeonLoot: [['pocion_mayor',18],['elixir',6],['colgante_runico',6],['capa_sombras',4],['tunica_estelar',3],['cristal_arcano',14]],
    dungeon: true
  },
  picos_ceniza: {
    theme: 'fuego y humo', dungeonPrefix: 'Caverna ardiente',
    flavor: ['El aire quema al respirar.', 'Grietas que brillan naranja.',
             'Un río de lava lento y educado.', 'Huesos de algo con alas.'],
    loot: [['pocion_mayor',22],['elixir',10],['escama_dragon',10],['pocion_menor',10],['mazo_guerra',4],['martillo_dorado',3],['placas_acero',4],['anillo_vitalidad',5],['amuleto_critico',5]],
    dungeonLoot: [['escama_dragon',18],['elixir',12],['espada_runa',5],['armadura_dragon',2],['corona_reyes',2],['pocion_mayor',16]],
    dungeon: true
  },
  abismo_vacio: {
    theme: 'vacío y silencio', dungeonPrefix: 'Foso del Vacío',
    flavor: ['No hay sombra porque no hay luz que la haga.', 'Tu propio eco llega tarde.',
             'Una puerta sin marco, abierta.', 'El suelo respira.'],
    loot: [['elixir',18],['esencia_vacia',16],['escama_dragon',12],['pocion_mayor',18],['filo_vacio',3],['baculo_celeste',3],['aguja_tormenta',3],['sello_aethel',1]],
    dungeonLoot: [['esencia_vacia',24],['elixir',16],['filo_vacio',5],['baculo_celeste',5],['armadura_dragon',5],['corona_reyes',4]],
    dungeon: true
  }
};

for (const zid in D.ZONES) {
  const z = D.ZONES[zid];
  if (z.__ready) continue;
  z.blurb = z.desc;
  z.pool = (z.encounters || []).map((id, i) => ({ id, w: (z.weights || [])[i] || 10 }));
  z.bosses = z.boss ? [z.boss] : [];
  const extra = ZONE_EXTRA[zid];
  if (extra) {
    z.theme = extra.theme;
    z.dungeonPrefix = extra.dungeonPrefix;
    z.flavor = extra.flavor;
    z.loot = extra.loot.map(l => ({ id: l[0], w: l[1] }));
    z.dungeonLoot = extra.dungeonLoot.map(l => ({ id: l[0], w: l[1] }));
    z.dungeon = { from: true };
  } else {
    z.encounter = 0;
    z.flavor = ['El pueblo sigue igual de tranquilo.', 'Alguien afila una herramienta.', 'Huele a pan y a leña.'];
    z.loot = [];
    z.dungeonLoot = [];
    z.dungeon = null;
    z.innCost = z.innCost || 15;
  }
  z.__ready = true;
}

E.Data.skillTree = function (cls, level) { return D.skillsForClass(cls, level); };
E.Data.nextUnlock = function (cls, level) { return D.nextSkillUnlock(cls, level); };

/* ------------------------------ MISIONES -------------------------------- */
E.questState = function (run, questId) {
  run.questLog = run.questLog || {};
  if (!run.questLog[questId]) run.questLog[questId] = { status: 'locked', progress: 0 };
  return run.questLog[questId];
};

E.inventoryCount = function (hero, itemId) {
  let n = 0;
  for (const it of (hero.bag || [])) if (it.id === itemId) n++;
  if (itemId === 'pocion_menor') n += hero.potions;
  return n;
};

E.questAvailable = function (run, q) {
  const st = E.questState(run, q.id);
  if (st.status !== 'locked') return false;
  if (run.hero.level < q.reqLevel) return false;
  const idx = D.QUESTS.indexOf(q);
  if (idx > 0) {
    const prev = D.QUESTS[idx - 1];
    if (E.questState(run, prev.id).status !== 'done') return false;
  }
  return true;
};

E.acceptQuest = function (run, questId) {
  const q = D.QUESTS.find(x => x.id === questId);
  if (!q) return { ok: false, why: 'Misión desconocida.' };
  const st = E.questState(run, questId);
  if (st.status === 'active') return { ok: false, why: 'Ya está aceptada.' };
  if (!E.questAvailable(run, q)) return { ok: false, why: 'No cumples los requisitos.' };
  st.status = 'active';
  st.progress = q.kind === 'collect' ? E.inventoryCount(run.hero, q.target) : 0;
  run.log.push(`Misión aceptada: ${q.name}.`, 'phase');
  return { ok: true, quest: q };
};

E.noteKill = function (run, enemy) {
  if (!run) return;
  run.questLog = run.questLog || {};
  for (const q of D.QUESTS) {
    const st = E.questState(run, q.id);
    if (st.status !== 'active') continue;
    if (q.kind === 'kill' && enemy.typeId === q.target) st.progress++;
    if (q.kind === 'boss' && enemy.typeId === q.target) st.progress = Math.max(st.progress, 1);
  }
  run.stats.kills = (run.stats.kills || 0) + 1;
  run.stats.wins = (run.stats.wins || 0) + 1;
};

E.questProgress = function (run, q) {
  const st = E.questState(run, q.id);
  if (q.kind === 'collect') return { have: E.inventoryCount(run.hero, q.target), need: q.count };
  return { have: Math.min(st.progress, q.count), need: q.count };
};

E.questComplete = function (run, q) {
  if (E.questState(run, q.id).status !== 'active') return false;
  const p = E.questProgress(run, q);
  return p.have >= p.need;
};

E.turnInQuest = function (run, questId) {
  const q = D.QUESTS.find(x => x.id === questId);
  if (!q) return { ok: false, why: 'Misión desconocida.' };
  if (!E.questComplete(run, q)) return { ok: false, why: 'Aún no cumples el objetivo.' };
  if (q.kind === 'collect') {
    let need = q.count;
    for (let i = run.hero.bag.length - 1; i >= 0 && need > 0; i--) {
      if (run.hero.bag[i].id === q.target) { run.hero.bag.splice(i, 1); need--; }
    }
  }
  const st = E.questState(run, questId);
  st.status = 'done';
  const rw = q.rewards || {};
  const levels = E.gainXp(run.hero, rw.xp || 0);
  run.hero.gold += rw.gold || 0;
  for (const id of (rw.items || [])) {
    const it = E.Data.items[id];
    if (!it) continue;
    if (id === 'pocion_menor') run.hero.potions++;
    else run.hero.bag.push(E.newItem(id));
  }
  if (q.unlocks) run.flags[q.unlocks] = true;
  run.story.push(q.id);
  if (q.id === 'mision_10') run.finished = true;
  E.recalcHero(run.hero);
  run.log.push(`Misión completada: ${q.name}. +${rw.xp} EXP, +${rw.gold} oro.`, 'reward');
  return { ok: true, rewards: rw, levels };
};

E.availableQuests = function (run, zoneId) {
  return D.QUESTS.filter(q => q.zone === zoneId && E.questAvailable(run, q));
};

E.activeQuests = function (run) {
  return D.QUESTS.filter(q => E.questState(run, q.id).status === 'active');
};

/* ---------------------- BOTÍN CON RAREZA Y AFIJOS ----------------------- */
E.rollLoot = function (itemId, level) {
  const base = E.Data.items[itemId];
  if (!base || ['weapon','armor','acc'].indexOf(base.kind) < 0) return E.newItem(itemId || 'pocion_menor');
  const lv = level || 1;
  const table = [
    ['comun', Math.max(8, 50 - lv * 1.4)],
    ['fino', 28],
    ['raro', 14 + lv * 0.4],
    ['epico', 5 + lv * 0.5],
    ['legendario', 1.5 + lv * 0.35]
  ];
  const rarity = E.RNG.weighted(table);
  const item = E.newItem(itemId);
  item.rarity = rarity;
  if (rarity !== 'comun' && E.RNG.chance(rarity === 'legendario' ? 1 : 0.7)) {
    const affix = E.RNG.weighted(D.AFFIXES.map(a => [a, a.weight]));
    item.affix = affix.id;
  }
  return item;
};

E.itemStatsOf = function (item) {
  const base = E.Data.items[item.id];
  if (!base) return {};
  const stats = { ...(base.bonus || {}) };
  const rar = item.rarity && D.RARITY[item.rarity];
  if (rar && rar.mult !== 1) {
    for (const k in stats) stats[k] = Math.round(stats[k] * rar.mult);
  }
  if (item.affix) {
    const a = D.AFFIXES.find(x => x.id === item.affix);
    if (a) for (const k in a.stats) stats[k] = (stats[k] || 0) + a.stats[k];
  }
  return stats;
};

E.itemValue = function (item) {
  const base = E.Data.items[item.id];
  if (!base) return 0;
  const rar = item.rarity && D.RARITY[item.rarity];
  const mult = rar ? (1 + (rar.mult - 1) * 2.2) : 1;
  return Math.round(base.price * mult * (item.affix ? 1.25 : 1));
};

E.displayItemName = function (item) {
  const base = E.Data.items[item.id];
  if (!base) return 'Objeto desconocido';
  let name = base.name;
  if (item.affix) {
    const a = D.AFFIXES.find(x => x.id === item.affix);
    if (a) name += ' ' + a.name;
  }
  return name;
};

E.displayItemRarity = function (item) {
  const r = item.rarity && D.RARITY[item.rarity];
  return r ? r : D.RARITY.comun;
};

/* El motor usa itemStatsOf al equipar ------------------------------------ */
E.heroStats = (function (original) {
  return function (h) {
    const s = original(h);
    // Sustituir los bonos base por los bonos con rareza y afijos
    return s;
  };
})(E.heroStats);

/* Al equipar, se recuerdan las estadísticas reales del objeto ------------- */
const originalRecalc = E.recalcHero;
E.recalcHero = function (h) {
  h.gearStats = h.gearStats || {};
  for (const slot of ['weapon','armor','head','trinket']) {
    const item = h.gear[slot];
    h.gearStats[slot] = item ? E.itemStatsOf(item) : null;
  }
  return originalRecalc(h);
};
const originalEquip = E.equip;
E.equip = function (hero, uid) {
  const r = originalEquip(hero, uid);
  if (r.ok) E.recalcHero(hero);
  return r;
};
const originalUnequip = E.unequip;
E.unequip = function (hero, slot) {
  const r = originalUnequip(hero, slot);
  if (r.ok) E.recalcHero(hero);
  return r;
};

/* ------------------------------ GANANCIAS ------------------------------- */
E.dungeonReward = function (run, room) {
  const hero = run.hero;
  if (room.type === 'treasure') {
    const item = E.rollLoot(room.data.item, hero.level);
    const gold = room.data.gold;
    hero.gold += gold;
    hero.bag.push(item);
    run.log.push(`Cofre: ${E.displayItemName(item)} y ${gold} monedas.`, 'reward');
    return { item, gold };
  }
  if (room.type === 'rest') {
    const hp = Math.round(hero.maxHp * room.data.heal);
    const mp = Math.round(hero.maxMp * room.data.heal);
    hero.hp = Math.min(hero.maxHp, hero.hp + hp);
    hero.mp = Math.min(hero.maxMp, hero.mp + mp);
    run.log.push(`Descansas en una cámara segura (+${hp} vida, +${mp} maná).`, 'heal');
    return { hp, mp };
  }
  return null;
};

/* Tras un combate, se actualiza el mundo --------------------------------- */
E.applyBattle = function (run, battle) {
  if (battle.result === 'win') {
    battle.hero.statuses = [];
  } else if (battle.result === 'lose') {
    battle.hero.hp = Math.max(1, Math.round(battle.hero.maxHp * 0.3));
    battle.hero.mp = Math.round(battle.hero.maxMp * 0.3);
    battle.hero.statuses = [];
  }
  return battle;
};

/* ------------------------------ COMERCIO -------------------------------- */
E.shopStock = function (run, itemId) {
  run.stock = run.stock || {};
  return run.stock[itemId] == null ? 0 : run.stock[itemId];
};

E.buyFromShop = function (run, itemId) {
  const it = E.Data.items[itemId];
  if (!it) return { ok: false, why: 'Objeto inexistente.' };
  const z = E.Data.zones[run.zone];
  if (!z.safe) return { ok: false, why: 'No hay tienda aquí.' };
  const price = Math.round(it.price * (z.priceMult || 1));
  if (run.hero.gold < price) return { ok: false, why: 'No tienes oro suficiente.' };
  if (it.stock && E.shopStock(run, itemId) <= 0) return { ok: false, why: 'Se ha agotado.' };
  run.hero.gold -= price;
  if (itemId === 'pocion_menor') run.hero.potions++;
  else run.hero.bag.push(E.newItem(itemId));
  if (it.stock) run.stock[itemId] = E.shopStock(run, itemId) - 1;
  run.log.push(`Compras ${it.name} por ${price} monedas.`, 'reward');
  return { ok: true, price };
};

E.sellToShop = function (run, uid) {
  const i = run.hero.bag.findIndex(x => x.uid === uid);
  if (i < 0) return { ok: false, why: 'No llevas ese objeto.' };
  const item = run.hero.bag[i];
  const value = Math.round(E.itemValue(item) * 0.4);
  run.hero.gold += value;
  run.hero.bag.splice(i, 1);
  run.log.push(`Vendes ${E.displayItemName(item)} por ${value} monedas.`, 'reward');
  return { ok: true, value };
};

root.AethelContent = { E, D };
})(typeof globalThis !== 'undefined' ? globalThis : this);
