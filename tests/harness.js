/* =========================================================================
   CRÓNICAS DE AETHEL — Arnés de pruebas del motor
   Ejecutable con «node tests/harness.js» o desde el navegador con
   AethelTests.main(AethelEngine). Comprueba las rutas críticas del juego.
   ========================================================================= */
(function (root) {
'use strict';

const report = { passed: 0, failed: 0, failures: [], notes: [] };
function ok(cond, msg) {
  if (cond) { report.passed++; return true; }
  report.failed++;
  report.failures.push(msg);
  return false;
}
function note(msg) { report.notes.push(msg); }
function suite(label, fn) {
  const before = report.failed;
  try { fn(); } catch (e) {
    report.failed++;
    report.failures.push(`${label}: excepción → ${e && e.message ? e.message : e}`);
  }
  report.notes.push((report.failed > before ? '✗ ' : '✓ ') + label);
}

function main(E) {
  if (!E) throw new Error('Falta el motor (AethelEngine).');
  E.RNG.seed(1234567);

  /* 1. Datos ------------------------------------------------------------ */
  suite('Integridad de la capa de datos', () => {
    ok(Object.keys(E.Data.classes).length === 4, 'deben existir 4 clases');
    ok(Object.keys(E.Data.skills).length >= 40, 'deben existir al menos 40 habilidades');
    ok(Object.keys(E.Data.items).length >= 60, 'deben existir al menos 60 objetos');
    ok(Object.keys(E.Data.enemies).length >= 16, 'deben existir al menos 16 enemigos');
    ok(Object.keys(E.Data.zones).length === 7, 'deben existir 7 zonas');
    ok(E.Data.quests.length === 10, 'deben existir 10 misiones');
    for (const cid in E.Data.classes) {
      const c = E.Data.classes[cid];
      ok(c.hp > 0 && c.mp > 0, `la clase ${cid} debe tener vida y maná`);
      ok(c.base.str > 0 && c.base.con > 0, `la clase ${cid} debe tener estadísticas`);
      for (const sid of c.startSkills) ok(!!E.Data.skills[sid], `la clase ${cid} apunta a una habilidad existente`);
    }
    for (const sid in E.Data.skills) {
      const s = E.Data.skills[sid];
      ok(!!s.cls, `la habilidad ${sid} debe tener clase`);
      ok(!!s.kind, `la habilidad ${sid} debe tener tipo de efecto`);
      ok(E.Data.skills[sid].mp >= 0, `la habilidad ${sid} debe tener coste`);
    }
    for (const eid in E.Data.enemies) {
      const e = E.Data.enemies[eid];
      ok(e.hp > 0 && e.atk > 0 && e.def > 0, `el enemigo ${eid} debe tener estadísticas`);
      ok(!!e.rewards, `el enemigo ${eid} debe dar recompensas`);
    }
  });

  /* 2. Daño -------------------------------------------------------------- */
  suite('Fórmula de daño y elementos', () => {
    const h = E.heroFromClass('warrior');
    const e = E.makeEnemy('rata_gigante', 1);
    E.RNG.seed(7);
    const r = E.computeDamage(h, e, { power: 1 });
    ok(r.damage > 0, 'el daño debe ser positivo');
    ok(r.damage < 2000, 'el daño no debe desbordarse');
    const zombie = E.makeEnemy('esqueleto_guerrero', 3);
    E.RNG.seed(7);
    const neutro = E.computeDamage(h, zombie, { power: 1, element: null });
    E.RNG.seed(7);
    const sagrado = E.computeDamage(h, zombie, { power: 1, element: 'holy' });
    ok(sagrado.damage > neutro.damage, 'la debilidad elemental debe aumentar el daño');
    const fuego = E.computeDamage(h, zombie, { power: 1, element: 'fire' });
    ok(fuego.damage > 0, 'el fuego debe hacer daño normal');
  });

  /* 3. Iniciativa -------------------------------------------------------- */
  suite('Iniciativa y orden de turnos', () => {
    const h = E.heroFromClass('rogue');
    const b = E.startBattle(h, [E.makeEnemy('goblin', 2), E.makeEnemy('lobo_negro', 2)]);
    ok(b.order.length === 3, 'deben entrar los tres combatientes');
    ok(b.active != null, 'debe haber un turno activo');
    const rapida = E.initiative(E.heroFromClass('rogue'));
    const lenta = E.initiative(E.heroFromClass('warrior'));
    ok(rapida > lenta, 'la pícara debe tener más iniciativa que el guerrero');
  });

  /* 4. Estados ----------------------------------------------------------- */
  suite('Estados alterados', () => {
    const e = E.makeEnemy('lobo_negro', 3);
    const hp0 = e.hp;
    E.addStatus(e, 'poison', 3, 1);
    ok(E.hasStatus(e, 'poison'), 'el veneno debe aplicarse');
    E.tickStatuses(e, null);
    ok(e.hp < hp0, 'el veneno debe restar vida al pasar turno');
    E.addStatus(e, 'stun', 1, 1);
    E.tickStatuses(e, null);
    ok(!E.hasStatus(e, 'stun'), 'el aturdimiento debe caducar');
    E.addStatus(e, 'guard', 3, 0);
    const defBase = e.def;
    E.tickStatuses(e, null);
    ok(e.def === defBase, 'la guardia no altera la defensa base del enemigo');
  });

  /* 5. Niveles ----------------------------------------------------------- */
  suite('Experiencia y subida de nivel', () => {
    const h = E.heroFromClass('mage');
    const lvl0 = h.level;
    const events = E.gainXp(h, 100000);
    ok(h.level > lvl0, 'debe subir de nivel');
    ok(events.length > 0, 'debe informar de los niveles');
    ok(h.maxHp > 0 && h.maxMp > 0, 'las reservas deben ser positivas');
    ok(h.skillPoints > 2, 'debe ganar puntos de habilidad');
    ok(E.xpForLevel(2) > E.xpForLevel(1), 'la experiencia requerida debe crecer');
    const antes = E.heroAttack(h);
    h.base.str += 10;
    E.recalcHero(h);
    ok(E.heroAttack(h) > antes, 'más fuerza debe subir el ataque');
  });

  /* 6. Habilidades ------------------------------------------------------- */
  suite('Habilidades: coste, efecto y limpieza', () => {
    const h = E.heroFromClass('cleric');
    h.level = 20;
    h.skillPoints = 20;
    for (const sid of E.Data.skillTree('cleric', 20)) E.learnSkill(h, sid);
    ok((h.skills['curar'] || 0) > 0, 'debe aprender Curar');
    const b = E.startBattle(h, [E.makeEnemy('rata_gigante', 1)]);
    h.mp = 0;
    const sinMana = E.useSkill(h, h, 'curar', b.log, b.units);
    ok(sinMana.ok === false, 'no debe poder curar sin maná');
    h.mp = 200;
    h.hp = 20;
    E.useSkill(h, h, 'curar', b.log, b.units);
    ok(h.hp > 20, 'la curación debe restaurar vida');
    const antes = h.mp;
    const dano = E.useSkill(h, b.enemies[0], 'luces', b.log, b.units);
    ok(dano.ok === true, 'debe poder lanzar Luces sagradas');
    ok(h.mp < antes, 'lanzar una habilidad debe gastar maná');
    // limpieza
    E.addStatus(h, 'poison', 5, 1);
    E.useSkill(h, h, 'purificar', b.log, b.units);
    ok(!E.hasStatus(h, 'poison'), 'Purificar debe eliminar los estados negativos');
    // área
    const b2 = E.startBattle(h, [E.makeEnemy('goblin', 1), E.makeEnemy('goblin', 1)]);
    h.mp = 500;
    const antesHp = b2.enemies.map(x => x.hp);
    E.useSkill(h, b2.enemies[0], 'juicio', b2.log, b2.units);
    ok(b2.enemies[0].hp < antesHp[0] && b2.enemies[1].hp < antesHp[1], 'Juicio debe dañar a todos');
  });

  /* 7. Inventario -------------------------------------------------------- */
  suite('Tienda, equipo y botín con rareza', () => {
    const run = E.newRun('warrior');
    const h = run.hero;
    h.gold = 5000;
    ok(E.buyFromShop(run, 'espada_corta').ok, 'debe poder comprar en la aldea');
    const item = h.bag[h.bag.length - 1];
    ok(E.equip(h, item.uid).ok, 'debe poder equiparla');
    ok(h.gear.weapon != null, 'el arma debe quedar en la ranura');
    const conArma = E.heroAttack(h);
    E.unequip(h, 'weapon');
    ok(E.heroAttack(h) < conArma, 'sin arma el ataque baja');
    const oro0 = h.gold;
    const vendido = E.sellToShop(run, h.bag[h.bag.length - 1].uid);
    ok(vendido.ok && h.gold > oro0, 'vender debe dar oro');
    // rarezas
    let legendarios = 0, total = 0;
    for (let i = 0; i < 400; i++) {
      const l = E.rollLoot('espada_corta', 10);
      total++;
      if (l.rarity === 'legendario') legendarios++;
      ok(!!l.rarity, 'todo el botín debe tener rareza');
    }
    ok(legendarios > 0 && legendarios < total, 'deben salir legendarios, pero no siempre');
    const mejor = { id: 'espada_corta', rarity: 'legendario', affix: 'hp' };
    ok(E.itemValue(mejor) > E.Data.items.espada_corta.price, 'un legendario debe valer más que la base');
    ok(Object.keys(E.itemStatsOf(mejor)).length > 0, 'debe calcular estadísticas del objeto');
  });

  /* 8. Combate ----------------------------------------------------------- */
  suite('Combate completo resuelto por la IA', () => {
    const h = E.heroFromClass('warrior');
    const b = E.startBattle(h, [E.makeEnemy('goblin', 1), E.makeEnemy('rata_gigante', 1)]);
    E.autoBattle(b, 'balanced');
    ok(b.over, 'el combate debe terminar');
    ok(['win','lose','flee','draw'].indexOf(b.result) >= 0, 'debe haber un resultado válido');
    ok(b.log.entries.length > 3, 'el diario debe registrar acciones');
    if (b.result === 'win') {
      ok(b.rewards.xp > 0, 'ganar debe dar experiencia');
      ok(h.gold > 60, 'ganar debe dar oro');
    }
  });

  /* 9. Jefes ------------------------------------------------------------- */
  suite('Combate contra jefe con héroe desarrollado', () => {
    const h = E.heroFromClass('warrior');
    E.gainXp(h, 60000);
    h.skillPoints = 20;
    for (const sid of E.Data.skillTree('warrior', h.level)) E.learnSkill(h, sid);
    h.hp = h.maxHp; h.mp = h.maxMp; h.potions = 8;
    const boss = E.makeEnemy('rey_goblins', Math.max(6, h.level));
    const b = E.startBattle(h, [boss], { kind: 'boss', title: 'Prueba de jefe' });
    E.autoBattle(b, 'aggressive');
    ok(b.over, 'el combate debe terminar');
    ok(b.enemies[0].hp <= 0 || h.hp <= 0, 'o cae el jefe o cae el héroe');
    const noHuir = E.heroAction(b, { type: 'flee' });
    ok(noHuir.ok === false, 'no se puede huir de un jefe');
  });

  /* 10. Mazmorras -------------------------------------------------------- */
  suite('Generación y recorrido de mazmorras', () => {
    E.RNG.seed(99);
    for (let depth = 1; depth <= 4; depth++) {
      const d = E.generateDungeon('ruinas_qarim', depth, depth * 3);
      ok(d.rooms.length === 7 + depth * 2, `profundidad ${depth}: número de salas correcto`);
      ok(d.rooms[0].type === 'entrance', 'la primera sala es la entrada');
      ok(d.rooms[d.rooms.length - 1].type === 'boss', 'la última sala es el jefe');
      for (const r of d.rooms) {
        if (r.type === 'combat' || r.type === 'boss') ok(r.data.enemies.length > 0, 'sala de combate con enemigos');
        if (r.type === 'treasure') ok(!!r.data.item && r.data.gold > 0, 'tesoro con objeto y oro');
      }
      const run = E.newRun('rogue');
      run.dungeon = d;
      run.zone = 'ruinas_qarim';
      let guard = 0;
      while (!d.cleared && guard++ < 60) E.advanceDungeon(run);
      ok(d.cleared, 'la mazmorra debe poder completarse');
      ok(run.stats.bosses > 0, 'completar una mazmorra suma jefes derrotados');
    }
  });

  /* 11. Exploración ------------------------------------------------------ */
  suite('Exploración: 800 pasos sin fallos', () => {
    const run = E.newRun('mage');
    E.acceptQuest(run, 'mision_01');
    let batallas = 0, objetos = 0, oro = 0;
    for (let i = 0; i < 800; i++) {
      const r = E.exploreStep(run);
      if (r.type === 'battle') {
        batallas++;
        const b = E.startBattle(run.hero, r.enemies, { run });
        b.run = run;
        E.autoBattle(b, 'balanced');
        E.applyBattle(run, b);
      }
      if (r.type === 'loot') objetos++;
      if (r.type === 'gold') oro++;
      if (run.hero.hp <= 0) run.hero.hp = run.hero.maxHp;
    }
    ok(batallas > 50, `debe haber muchos encuentros (hubo ${batallas})`);
    ok(objetos > 0, 'debe encontrar objetos');
    ok(oro > 0, 'debe encontrar oro');
    ok(isFinite(run.hero.gold), 'el oro debe ser un número válido');
    ok(E.questState(run, 'mision_01').progress > 0, 'matar lobos debe avanzar la misión');
    note(`800 pasos → ${batallas} combates, ${objetos} objetos, ${oro} hallazgos de oro, nivel ${run.hero.level}`);
  });

  /* 12. Misiones --------------------------------------------------------- */
  suite('Misiones: aceptar, progresar y entregar', () => {
    const run = E.newRun('cleric');
    run.hero.level = 5;
    ok(E.availableQuests(run, 'aldea_inicio').length === 1, 'la primera misión debe estar disponible');
    ok(E.acceptQuest(run, 'mision_01').ok, 'debe aceptarse');
    ok(E.activeQuests(run).length === 1, 'debe figurar como activa');
    const q = E.Data.quests[0];
    for (let i = 0; i < q.count; i++) E.noteKill(run, { typeId: q.target });
    ok(E.questComplete(run, q), 'debe estar completa');
    const oro0 = run.hero.gold;
    const r = E.turnInQuest(run, q.id);
    ok(r.ok && run.hero.gold > oro0, 'entregar debe dar recompensas');
    ok(E.questState(run, q.id).status === 'done', 'debe quedar como completada');
    ok(!!run.flags[q.unlocks], 'debe abrir la zona indicada');
    ok(E.availableQuests(run, 'bosque_umbrio').length >= 1, 'la siguiente misión debe aparecer');
    // misión de recolección
    const q3 = E.Data.quests.find(x => x.kind === 'collect');
    run.hero.level = 30;
    run.questLog[q3.id] = { status: 'active', progress: 0 };
    for (let i = 0; i < q3.count; i++) run.hero.bag.push(E.newItem(q3.target));
    ok(E.questComplete(run, q3), 'la recolección debe completarse con los objetos');
    const antes = run.hero.bag.filter(i => i.id === q3.target).length;
    E.turnInQuest(run, q3.id);
    ok(run.hero.bag.filter(i => i.id === q3.target).length < antes, 'entregar consume los objetos');
  });

  /* 13. Guardado --------------------------------------------------------- */
  suite('Guardado y restauración fiel', () => {
    const run = E.newRun('cleric');
    E.gainXp(run.hero, 500);
    run.hero.gold = 777;
    run.hero.bag.push(E.newItem('cristal_arcano'));
    run.stats.steps = 42;
    run.flags.ruinas_qarim = true;
    E.acceptQuest(run, 'mision_01');
    const texto = E.stringifySave(run);
    ok(typeof texto === 'string' && texto.length > 50, 'el guardado debe ser texto');
    const back = E.parseSave(texto);
    ok(back.hero.classId === run.hero.classId, 'la clase se conserva');
    ok(back.hero.level === run.hero.level, 'el nivel se conserva');
    ok(back.hero.gold === run.hero.gold, 'el oro se conserva');
    ok(back.hero.bag.length === run.hero.bag.length, 'la mochila se conserva');
    ok(back.stats.steps === 42, 'las estadísticas se conservan');
    ok(back.flags.ruinas_qarim === true, 'las banderas de mundo se conservan');
    ok(E.questState(back, 'mision_01').status === 'active', 'el diario de misiones se conserva');
    ok(back.hero.skills && Object.keys(back.hero.skills).length > 0, 'las habilidades se conservan');
    let lanzo = false;
    try { E.parseSave('{"v":3,"run":null}'); } catch (e) { lanzo = true; }
    ok(lanzo, 'un guardado corrupto debe fallar');
  });

  /* 14. Partida larga ---------------------------------------------------- */
  suite('Partida completa simulada (4000 pasos)', () => {
    E.RNG.seed(20260101);
    const run = E.newRun('warrior', 'Pruebín');
    let combates = 0, victorias = 0, mazmorras = 0, misiones = 0;
    for (let i = 0; i < 4000; i++) {
      if (i % 120 === 0) {
        for (const q of E.availableQuests(run, run.zone)) {
          if (E.acceptQuest(run, q.id).ok) misiones++;
        }
      }
      for (const q of E.activeQuests(run)) {
        if (E.questComplete(run, q) && E.turnInQuest(run, q.id).ok) misiones++;
      }
      const r = E.exploreStep(run);
      if (r.type === 'battle') {
        combates++;
        const b = E.startBattle(run.hero, r.enemies, { run });
        b.run = run;
        E.autoBattle(b, 'balanced');
        E.applyBattle(run, b);
        if (b.result === 'win') victorias++;
      }
      if (run.hero.skillPoints > 0) {
        for (const sid of E.Data.skillTree(run.hero.classId, run.hero.level)) {
          if (E.learnSkill(run.hero, sid).ok) break;
        }
      }
      if (run.hero.hp < run.hero.maxHp * 0.5) {
        run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + Math.round(run.hero.maxHp * 0.3));
        run.hero.mp = Math.min(run.hero.maxMp, run.hero.mp + Math.round(run.hero.maxMp * 0.3));
      }
      if (E.Data.zones[run.zone].safe) {
        for (const slot of ['weapon','armor','head','trinket']) {
          if (!run.hero.gear[slot]) {
            const mejor = run.hero.bag.find(it => E.Data.items[it.id] && E.Data.items[it.id].slot === (slot === 'trinket' ? 'acc1' : slot));
            if (mejor) E.equip(run.hero, mejor.uid);
          }
        }
      }
      if (i % 500 === 0) {
        const d = E.enterDungeon(run);
        if (d.ok) {
          let guard = 0;
          while (!run.dungeon.cleared && guard++ < 40) {
            const room = E.dungeonRoom(run);
            if (room.type === 'combat' || room.type === 'boss') {
              const b = E.startBattle(run.hero, room.data.enemies, { kind: room.type, title: room.data.title, run });
              b.run = run;
              E.autoBattle(b, 'aggressive');
              E.applyBattle(run, b);
            } else if (room.type === 'treasure' || room.type === 'rest') {
              E.dungeonReward(run, room);
            }
            E.advanceDungeon(run);
            if (run.hero.hp <= 0) run.hero.hp = Math.max(1, Math.round(run.hero.maxHp * 0.4));
          }
          mazmorras++;
          E.leaveDungeon(run);
        }
      }
      if (run.hero.hp <= 0) run.hero.hp = 1;
    }
    const back = E.parseSave(E.stringifySave(run));
    ok(combates > 500, `debe haber muchos combates (hubo ${combates})`);
    ok(victorias > 0, 'debe ganar combates');
    ok(mazmorras > 0, `debe completar mazmorras (hubo ${mazmorras})`);
    ok(misiones > 0, `debe completar misiones (hubo ${misiones})`);
    ok(run.hero.level > 5, `debe subir de nivel (llegó a ${run.hero.level})`);
    ok(back.hero.level === run.hero.level, 'debe guardar la partida al final');
    note(`4000 pasos → ${combates} combates (${victorias} victorias), ${mazmorras} mazmorras, ${misiones} misiones entregadas, nivel ${run.hero.level}, oro ${run.hero.gold}`);
  });

  /* 15. Rendimiento ------------------------------------------------------ */
  suite('Rendimiento: 200 combates en menos de 6 s', () => {
    const t0 = Date.now();
    let turnos = 0;
    for (let i = 0; i < 200; i++) {
      const h = E.heroFromClass('rogue');
      const b = E.startBattle(h, [E.makeEnemy('goblin', 2), E.makeEnemy('lobo_negro', 2)]);
      E.autoBattle(b, 'balanced');
      turnos += b.log.entries.length;
    }
    const ms = Date.now() - t0;
    ok(ms < 6000, `200 combates deben resolverse rápido (tardó ${ms} ms)`);
    note(`200 combates (${turnos} entradas de diario) en ${ms} ms`);
  });

  /* 16. Cobertura de habilidades ----------------------------------------- */
  suite('Todas las habilidades se pueden ejecutar', () => {
    for (const cls of ['warrior','mage','rogue','cleric']) {
      const h = E.heroFromClass(cls);
      h.level = 30; h.skillPoints = 60;
      for (const sid of E.Data.skillTree(cls, 30)) E.learnSkill(h, sid);
      E.recalcHero(h);
      h.hp = h.maxHp; h.mp = 9999;
      const b = E.startBattle(h, [E.makeEnemy('goblin', 5), E.makeEnemy('goblin', 5), E.makeEnemy('lobo_negro', 5)]);
      b.run = null;
      for (const sid in h.skills) {
        const antes = b.log.entries.length;
        const r = E.useSkill(h, b.enemies[0], sid, b.log, b.units);
        ok(r.ok !== false, `la habilidad ${sid} (${cls}) debe ejecutarse`);
        ok(b.log.entries.length > antes, `la habilidad ${sid} (${cls}) debe narrar su efecto`);
        h.mp = 9999;
        for (const e of b.enemies) { e.hp = e.maxHp; }
        h.hp = h.maxHp;
      }
    }
  });

  return report;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { main, report };
else root.AethelTests = { main, report };

if (typeof module !== 'undefined' && module.exports && require.main === module) {
  const path = require('path');
  const E = require(path.join(__dirname, '..', 'js', 'engine.js'));
  const data = require(path.join(__dirname, '..', 'js', 'data.js'));
  E.Data = data;
  require(path.join(__dirname, '..', 'js', 'ui.js'));
  const r = main(E);
  const line = '─'.repeat(60);
  console.log(line);
  console.log('  CRÓNICAS DE AETHEL — ARNÉS DE PRUEBAS DEL MOTOR');
  console.log(line);
  for (const n of r.notes) console.log('  ' + n);
  console.log(line);
  console.log(`  PASA: ${r.passed}   FALLA: ${r.failed}`);
  if (r.failures.length) { console.log(line); for (const f of r.failures) console.log('  ✗ ' + f); }
  console.log(line);
  process.exit(r.failed ? 1 : 0);
}

})(typeof globalThis !== 'undefined' ? globalThis : this);
