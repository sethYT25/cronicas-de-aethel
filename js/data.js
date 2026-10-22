/* =============================================================================
   CRÓNICAS DE AETHEL — Capa de datos
   Contenido declarativo: elementos, estados, clases, habilidades, objetos,
   enemigos, zonas, misiones y eventos. Ningún efecto secundario aquí.
   ============================================================================= */
(function (root) {
'use strict';

const ELEMENTS = {
  neutral: { name:'Neutro',  color:'#c9d6ea', icon:'N' },
  fire:    { name:'Fuego',   color:'#ff7a45', icon:'F' },
  ice:     { name:'Hielo',   color:'#7fd7ff', icon:'H' },
  storm:   { name:'Tormenta',color:'#ffe066', icon:'T' },
  arcane:  { name:'Arcano',  color:'#c9a5ff', icon:'A' },
  holy:    { name:'Sagrado', color:'#ffe9a8', icon:'S' },
  shadow:  { name:'Sombra',  color:'#b06bff', icon:'O' }
};

const ELEM_TABLE = {
  neutral: { neutral:1,   fire:1,    ice:1,    storm:1,    arcane:1,   holy:1,   shadow:1 },
  fire:    { neutral:1,   fire:0.5,  ice:2,    storm:1,    arcane:1,   holy:1,   shadow:1 },
  ice:     { neutral:1,   fire:2,    ice:0.5,  storm:2,    arcane:1,   holy:1,   shadow:1 },
  storm:   { neutral:1,   fire:1,    ice:0.5,  storm:0.5,  arcane:1.5, holy:1,   shadow:1 },
  arcane:  { neutral:1,   fire:1,    ice:1,    storm:1.5,  arcane:0.5, holy:1,   shadow:1.5 },
  holy:    { neutral:1,   fire:1,    ice:1,    storm:1,    arcane:1,   holy:0.5, shadow:2 },
  shadow:  { neutral:1,   fire:1,    ice:1,    storm:1,    arcane:1.5, holy:1,   shadow:0.5 }
};

/* --------------------------------- ESTADOS -------------------------------- */
const STATUS = {
  poison:   { name:'Veneno',       kind:'dot',   icon:'V', color:'#7bff9c', dmg:'maxhp', ratio:0.05 },
  burn:     { name:'Quemadura',    kind:'dot',   icon:'Q', color:'#ff7a45', dmg:'flat',  ratio:0.0, power:9 },
  bleed:    { name:'Hemorragia',   kind:'dot',   icon:'H', color:'#ff4d6d', dmg:'atk',   ratio:0.28 },
  stun:     { name:'Aturdido',     kind:'control', icon:'!', color:'#ffe066' },
  slow:     { name:'Ralentizado',  kind:'debuff', icon:'R', color:'#7fd7ff', spd:-0.4 },
  weaken:   { name:'Debilitado',   kind:'debuff', icon:'D', color:'#9aa8c0', atk:-0.3 },
  vulnerable:{ name:'Vulnerable',  kind:'debuff', icon:'U', color:'#ff9f45', def:-0.35 },
  blind:    { name:'Cegado',       kind:'debuff', icon:'C', color:'#8fa6c6', acc:-0.35 },
  silence:  { name:'Silenciado',   kind:'debuff', icon:'S', color:'#b06bff', noSkills:true },
  regen:    { name:'Regeneración', kind:'buff',   icon:'+', color:'#7bffb2', healRatio:0.07 },
  haste:    { name:'Celeridad',    kind:'buff',   icon:'>>',color:'#64f0ff', spd:0.45 },
  might:    { name:'Poderío',      kind:'buff',   icon:'^', color:'#ffd166', atk:0.35 },
  guard:    { name:'Guardia',      kind:'buff',   icon:'G', color:'#9df6ff', def:0.45 },
  barrier:  { name:'Barrera',      kind:'buff',   icon:'B', color:'#ffe9a8', barrier:true },
  focus:    { name:'Concentración',kind:'buff',   icon:'F', color:'#c9a5ff', crit:0.25 }
};
const STATUS_KEYS = Object.keys(STATUS);

/* --------------------------------- CLASES --------------------------------- */
const CLASSES = {
  warrior: {
    id:'warrior', name:'Guerrero', role:'Tanque y daño físico',
    color:'#ff8f5e', sprite:'warrior',
    desc:'Aguanta lo que nadie aguanta y devuelve golpes que se sienten. Escala con fuerza y aguante.',
    base:{ hp:120, mp:20, str:16, dex:7, con:15, int:4, wis:6, luck:5 },
    growth:{ str:1.0, dex:0.4, con:1.0, int:0.1, wis:0.2, luck:0.25 },
    primary:'str', secondary:'con'
  },
  mage: {
    id:'mage', name:'Maga', role:'Daño mágico en área',
    color:'#c9a5ff', sprite:'mage',
    desc:'Rompe grupos enteros con hechizos elementales. Frágil, pero nadie mata más rápido.',
    base:{ hp:78, mp:70, str:5, dex:8, con:6, int:18, wis:11, luck:6 },
    growth:{ str:0.15, dex:0.5, con:0.35, int:1.0, wis:0.8, luck:0.3 },
    primary:'int', secondary:'wis'
  },
  rogue: {
    id:'rogue', name:'Pícara', role:'Crítico y ráfaga',
    color:'#7bffb2', sprite:'rogue',
    desc:'Golpea primero, golpea dos veces y casi nunca la ven venir. Vive del crítico y la evasión.',
    base:{ hp:92, mp:36, str:11, dex:17, con:8, int:6, wis:6, luck:14 },
    growth:{ str:0.6, dex:1.0, con:0.4, int:0.2, wis:0.2, luck:0.7 },
    primary:'dex', secondary:'luck'
  },
  cleric: {
    id:'cleric', name:'Clériga', role:'Sostén y sagrado',
    color:'#ffe9a8', sprite:'cleric',
    desc:'Cura, protege y castiga a los muertos vivientes con luz. La clase que hace posibles las mazmorras largas.',
    base:{ hp:100, mp:58, str:8, dex:6, con:11, int:15, wis:16, luck:6 },
    growth:{ str:0.3, dex:0.4, con:0.6, int:0.85, wis:1.0, luck:0.3 },
    primary:'wis', secondary:'int'
  }
};
const CLASS_KEYS = Object.keys(CLASSES);

/* ------------------------------- HABILIDADES ------------------------------ */
const SKILLS = {
  /* --- Guerrero --- */
  golpe_poderoso:{ name:'Golpe poderoso', cls:'warrior', tier:1, cost:6, cd:1, power:1.8, scale:'physical', target:'enemy', element:'neutral',
    desc:'Un golpe cargado que hace 180% de daño físico.', fx:'slash' },
  grito_guerra:{ name:'Grito de guerra', cls:'warrior', tier:1, cost:8, cd:4, power:0, scale:'none', target:'self', element:'neutral',
    desc:'Otorga Poderío (daño +35%) durante 3 turnos.', apply:[{ id:'might', turns:3, chance:1 }], fx:'buff' },
  muro_acero:{ name:'Muro de acero', cls:'warrior', tier:1, cost:7, cd:3, power:0, scale:'none', target:'self', element:'neutral',
    desc:'Otorga Guardia (defensa +45%) durante 3 turnos.', apply:[{ id:'guard', turns:3, chance:1 }], fx:'buff' },
  torbellino:{ name:'Torbellino', cls:'warrior', tier:2, cost:12, cd:3, power:1.15, scale:'physical', target:'allEnemies', element:'neutral',
    desc:'Gira el arma y golpea a todos los enemigos.', fx:'slashAll' },
  embestida:{ name:'Embestida', cls:'warrior', tier:2, cost:10, cd:2, power:1.4, scale:'physical', target:'enemy', element:'neutral',
    desc:'Embiste con 140% de daño y 45% de ralentizar.', apply:[{ id:'slow', turns:2, chance:0.45 }], fx:'charge' },
  romper_guardia:{ name:'Romper guardia', cls:'warrior', tier:2, cost:9, cd:3, power:1.2, scale:'physical', target:'enemy', element:'neutral',
    desc:'Golpe que deja al objetivo Vulnerable (defensa -35%) 3 turnos.', apply:[{ id:'vulnerable', turns:3, chance:0.8 }], fx:'shatter' },
  terremoto:{ name:'Terremoto', cls:'warrior', tier:3, cost:22, cd:5, power:1.7, scale:'physical', target:'allEnemies', element:'neutral',
    desc:'Sacude el suelo: daño a todos y 40% de aturdir.', apply:[{ id:'stun', turns:1, chance:0.4 }], fx:'quake' },
  furia_sangrienta:{ name:'Furia sangrienta', cls:'warrior', tier:3, cost:18, cd:5, power:0, scale:'none', target:'self', element:'neutral',
    desc:'Poderío y Celeridad durante 4 turnos. Sacrifica 15% de la vida actual.', selfCost:{ hpRatio:0.15 }, apply:[{ id:'might', turns:4, chance:1 }, { id:'haste', turns:4, chance:1 }], fx:'buff' },
  ejecucion:{ name:'Ejecución', cls:'warrior', tier:4, cost:24, cd:4, power:2.6, scale:'physical', target:'enemy', element:'neutral',
    desc:'260% de daño; el doble si el enemigo está por debajo del 30% de vida.', execute:2.0, fx:'execute' },
  bastion:{ name:'Bastión', cls:'warrior', tier:4, cost:26, cd:6, power:0, scale:'none', target:'self', element:'neutral',
    desc:'Barrera que absorbe daño igual a 60% de tu vida máxima y Guardia por 3 turnos.', apply:[{ id:'guard', turns:3, chance:1 }, { id:'barrier', turns:3, chance:1, power:0.6 }], fx:'buff' },

  /* --- Maga --- */
  chispa:{ name:'Chispa arcana', cls:'mage', tier:1, cost:5, cd:0, power:1.6, scale:'magic', target:'enemy', element:'arcane',
    desc:'Proyectil arcano básico. Barato y fiable.', fx:'bolt' },
  bola_fuego:{ name:'Bola de fuego', cls:'mage', tier:1, cost:9, cd:1, power:1.9, scale:'magic', target:'enemy', element:'fire',
    desc:'Daño de fuego con 50% de quemar.', apply:[{ id:'burn', turns:3, chance:0.5 }], fx:'fire' },
  escarcha:{ name:'Aliento de escarcha', cls:'mage', tier:1, cost:9, cd:2, power:1.5, scale:'magic', target:'enemy', element:'ice',
    desc:'Hielo con 55% de ralentizar.', apply:[{ id:'slow', turns:3, chance:0.55 }], fx:'ice' },
  cadena_relampago:{ name:'Cadena de relámpagos', cls:'mage', tier:2, cost:16, cd:2, power:1.35, scale:'magic', target:'allEnemies', element:'storm',
    desc:'El rayo salta entre todos los enemigos.', fx:'storm' },
  congelar:{ name:'Congelar', cls:'mage', tier:2, cost:14, cd:4, power:1.0, scale:'magic', target:'enemy', element:'ice',
    desc:'Hielo con 45% de aturdir un turno.', apply:[{ id:'stun', turns:1, chance:0.45 }], fx:'ice' },
  drenar_vida:{ name:'Drenar vida', cls:'mage', tier:2, cost:13, cd:2, power:1.5, scale:'magic', target:'enemy', element:'shadow',
    desc:'Roba vida: te curas el 45% del daño hecho.', drain:0.45, fx:'drain' },
  tormenta_arcana:{ name:'Tormenta arcana', cls:'mage', tier:3, cost:24, cd:4, power:1.8, scale:'magic', target:'allEnemies', element:'arcane',
    desc:'Arcano puro en área amplia.', fx:'arcane' },
  meteorito:{ name:'Meteorito', cls:'mage', tier:3, cost:26, cd:5, power:2.5, scale:'magic', target:'enemy', element:'fire',
    desc:'Daño de fuego devastador a un objetivo y 40% a los demás.', splash:0.4, apply:[{ id:'burn', turns:3, chance:0.7 }], fx:'meteor' },
  prision_hielo:{ name:'Prisión de hielo', cls:'mage', tier:4, cost:20, cd:4, power:1.6, scale:'magic', target:'allEnemies', element:'ice',
    desc:'Congela a todos: daño y 50% de aturdir.', apply:[{ id:'stun', turns:1, chance:0.5 }], fx:'iceAll' },
  colapso_arcano:{ name:'Colapso arcano', cls:'mage', tier:4, cost:34, cd:6, power:3.1, scale:'magic', target:'enemy', element:'arcane',
    desc:'Concentra todo el maná en un solo impacto brutal.', fx:'collapse' },

  /* --- Pícara --- */
  punalada:{ name:'Puñalada', cls:'rogue', tier:1, cost:5, cd:0, power:1.5, scale:'physical', target:'enemy', element:'neutral',
    desc:'Ataque rápido con mayor probabilidad de crítico.', critBonus:0.2, fx:'stab' },
  doble_filo:{ name:'Doble filo', cls:'rogue', tier:1, cost:9, cd:2, power:0.95, scale:'physical', target:'enemy', element:'neutral', hits:2,
    desc:'Dos golpes consecutivos.', fx:'double' },
  veneno_artero:{ name:'Veneno artero', cls:'rogue', tier:1, cost:8, cd:3, power:0.8, scale:'physical', target:'enemy', element:'shadow',
    desc:'Envenena al objetivo (5% de su vida máxima por turno, 4 turnos).', apply:[{ id:'poison', turns:4, chance:1 }], fx:'poison' },
  sombra_veloz:{ name:'Sombra veloz', cls:'rogue', tier:2, cost:10, cd:4, power:0, scale:'none', target:'self', element:'neutral',
    desc:'Celeridad y Concentración (+25% crítico) durante 3 turnos.', apply:[{ id:'haste', turns:3, chance:1 }, { id:'focus', turns:3, chance:1 }], fx:'buff' },
  lluvia_cuchillos:{ name:'Lluvia de cuchillos', cls:'rogue', tier:2, cost:14, cd:3, power:0.9, scale:'physical', target:'allEnemies', element:'neutral',
    desc:'Daña a todos y aplica Hemorragia a cada uno.', apply:[{ id:'bleed', turns:3, chance:0.7 }], fx:'knives' },
  golpe_sombra:{ name:'Golpe de sombra', cls:'rogue', tier:2, cost:13, cd:2, power:1.7, scale:'physical', target:'enemy', element:'shadow',
    desc:'Golpe desde la oscuridad con +30% de crítico.', critBonus:0.3, fx:'shadowstab' },
  destripar:{ name:'Destripar', cls:'rogue', tier:3, cost:20, cd:4, power:2.4, scale:'physical', target:'enemy', element:'neutral',
    desc:'Daño masivo y Hemorragia garantizada.', apply:[{ id:'bleed', turns:4, chance:1 }], fx:'rip' },
  danza_cuchillos:{ name:'Danza de cuchillos', cls:'rogue', tier:3, cost:22, cd:4, power:0.8, scale:'physical', target:'enemy', element:'neutral', hits:4,
    desc:'Cuatro golpes rápidos con la probabilidad de crítico de cada uno.', fx:'flurry' },
  marca_cazador:{ name:'Marca del cazador', cls:'rogue', tier:4, cost:18, cd:5, power:1.3, scale:'physical', target:'enemy', element:'neutral',
    desc:'Marca al objetivo: Vulnerable 4 turnos y +35% de crítico contra él.', critBonus:0.35, apply:[{ id:'vulnerable', turns:4, chance:1 }], fx:'mark' },
  asesinato:{ name:'Asesinato', cls:'rogue', tier:4, cost:26, cd:6, power:3.0, scale:'physical', target:'enemy', element:'shadow',
    desc:'300% de daño. Si el objetivo muere, recuperas 25% de maná.', manaOnKill:0.25, fx:'assassinate' },

  /* --- Clériga --- */
  luces:{ name:'Luces sagradas', cls:'cleric', tier:1, cost:5, cd:0, power:1.4, scale:'magic', target:'enemy', element:'holy',
    desc:'Castiga con luz pura.', fx:'holy' },
  curar:{ name:'Curar', cls:'cleric', tier:1, cost:8, cd:1, power:1.6, scale:'heal', target:'self', element:'holy',
    desc:'Restaura vida igual a 160% de tu poder mágico.', fx:'heal' },
  bendicion:{ name:'Bendición', cls:'cleric', tier:1, cost:10, cd:4, power:0, scale:'none', target:'self', element:'holy',
    desc:'Poderío y Regeneración durante 3 turnos.', apply:[{ id:'might', turns:3, chance:1 }, { id:'regen', turns:3, chance:1 }], fx:'buff' },
  escudo_fe:{ name:'Escudo de fe', cls:'cleric', tier:2, cost:12, cd:4, power:0, scale:'none', target:'self', element:'holy',
    desc:'Barrera que absorbe daño igual a 45% de tu vida máxima.', apply:[{ id:'barrier', turns:3, chance:1, power:0.45 }], fx:'buff' },
  castigo:{ name:'Castigo divino', cls:'cleric', tier:2, cost:14, cd:2, power:1.9, scale:'magic', target:'enemy', element:'holy',
    desc:'Doble daño contra no-muertos y demonios.', vsTag:{ undead:2, demon:2 }, fx:'holybolt' },
  purificar:{ name:'Purificar', cls:'cleric', tier:2, cost:9, cd:3, power:0, scale:'none', target:'self', element:'holy',
    desc:'Elimina todos tus estados negativos y te cura un poco.', cleanse:true, healFlat:0.12, fx:'cleanse' },
  luz_sanadora:{ name:'Luz sanadora mayor', cls:'cleric', tier:3, cost:20, cd:4, power:3.2, scale:'heal', target:'self', element:'holy',
    desc:'Curación potente y elimina tus estados negativos.', cleanse:true, fx:'bigheal' },
  juicio:{ name:'Juicio', cls:'cleric', tier:3, cost:24, cd:4, power:1.5, scale:'magic', target:'allEnemies', element:'holy',
    desc:'Daño sagrado a todos los enemigos.', fx:'judgement' },
  silencio_ritual:{ name:'Ritual de silencio', cls:'cleric', tier:4, cost:18, cd:5, power:1.1, scale:'magic', target:'allEnemies', element:'holy',
    desc:'Daña y silencia a todos (no pueden usar habilidades) 3 turnos.', apply:[{ id:'silence', turns:3, chance:0.8 }], fx:'silence' },
  milagro:{ name:'Milagro', cls:'cleric', tier:4, cost:32, cd:7, power:3.6, scale:'heal', target:'self', element:'holy',
    desc:'Curación enorme, limpieza total y Regeneración 4 turnos.', cleanse:true, apply:[{ id:'regen', turns:4, chance:1 }], fx:'miracle' }
};

const SKILL_TREE = {
  warrior:{ 1:['golpe_poderoso','grito_guerra','muro_acero'], 3:['torbellino','embestida'], 4:['romper_guardia'],
            6:['terremoto','furia_sangrienta'], 8:['ejecucion'], 10:['bastion'] },
  mage:{ 1:['chispa','bola_fuego','escarcha'], 3:['cadena_relampago'], 4:['congelar','drenar_vida'],
         6:['tormenta_arcana'], 7:['meteorito'], 8:['prision_hielo'], 11:['colapso_arcano'] },
  rogue:{ 1:['punalada','doble_filo','veneno_artero'], 3:['sombra_veloz'], 4:['lluvia_cuchillos','golpe_sombra'],
          6:['destripar'], 7:['danza_cuchillos'], 8:['marca_cazador'], 11:['asesinato'] },
  cleric:{ 1:['luces','curar','bendicion'], 3:['escudo_fe'], 4:['castigo','purificar'],
           6:['luz_sanadora'], 7:['juicio'], 8:['silencio_ritual'], 11:['milagro'] }
};

function skillsForClass(cls, level) {
  const out = [];
  for (const lv of Object.keys(SKILL_TREE[cls]).map(Number).sort((a,b)=>a-b)) {
    if (level >= lv) out.push.apply(out, SKILL_TREE[cls][lv]);
  }
  return out;
}
function nextSkillUnlock(cls, level) {
  const lvls = Object.keys(SKILL_TREE[cls]).map(Number).sort((a,b)=>a-b);
  for (const lv of lvls) if (lv > level) return { level:lv, skills:SKILL_TREE[cls][lv] };
  return null;
}

/* --------------------------------- OBJETOS -------------------------------- */
const RARITY = {
  comun:    { name:'Común',    color:'#c9d6ea', mult:1.00 },
  fino:     { name:'Fino',     color:'#7bffb2', mult:1.18 },
  raro:     { name:'Raro',     color:'#64f0ff', mult:1.38 },
  epico:    { name:'Épico',    color:'#c9a5ff', mult:1.62 },
  legendario:{name:'Legendario',color:'#ffd166', mult:1.95 }
};
const RARITY_KEYS = Object.keys(RARITY);

const ITEMS = {
  daga_oxidada:{ name:'Daga oxidada', kind:'weapon', slot:'main', price:20, tier:1,
    bonus:{ str:5, dex:2 }, element:'neutral', req:1, desc:'Poco más que un trozo de metal con mango.' },
  espada_corta:{ name:'Espada corta', kind:'weapon', slot:'main', price:60, tier:1,
    bonus:{ str:9 }, element:'neutral', req:1, desc:'Equilibrada, fiable, aburrida.' },
  hacha_mano:{ name:'Hacha de mano', kind:'weapon', slot:'main', price:75, tier:1,
    bonus:{ str:13, crit:2 }, element:'neutral', req:2, desc:'Pesa, pero abre cosas.' },
  baston_aprendiz:{ name:'Bastón del aprendiz', kind:'weapon', slot:'main', price:55, tier:1,
    bonus:{ mag:8, mp:10 }, element:'neutral', req:1, desc:'Un bastón sencillo con un cristal barato.' },
  varita_roble:{ name:'Varita de roble', kind:'weapon', slot:'main', price:90, tier:2,
    bonus:{ mag:12, crit:4 }, element:'neutral', req:3, desc:'Mejora el flujo de maná.' },
  daga_sombria:{ name:'Daga sombría', kind:'weapon', slot:'main', price:110, tier:2,
    bonus:{ str:8, crit:6, eva:5 }, element:'shadow', req:3, desc:'Susurra nombres de gente que aún respira.' },
  mazo_guerra:{ name:'Mazo de guerra', kind:'weapon', slot:'main', price:150, tier:2,
    bonus:{ str:18, crit:2 }, element:'neutral', req:4, desc:'Convierte armaduras en chatarra.' },
  cetro_luz:{ name:'Cetro de luz', kind:'weapon', slot:'main', price:140, tier:2,
    bonus:{ mag:15, mp:14, wis:4 }, element:'holy', req:4, desc:'Cálido al tacto, siempre.' },
  espada_runa:{ name:'Espada rúnica', kind:'weapon', slot:'main', price:260, tier:3,
    bonus:{ str:24, crit:5, mag:6 }, element:'storm', req:7, desc:'Las runas giran despacio cerca de magia.' },
  vara_infernal:{ name:'Vara infernal', kind:'weapon', slot:'main', price:280, tier:3,
    bonus:{ mag:27, crit:5 }, element:'fire', req:7, desc:'Huele a azufre y a decisión apresurada.' },
  dientes_luna:{ name:'Dientes de la luna', kind:'weapon', slot:'main', price:300, tier:3,
    bonus:{ str:18, crit:12, dex:6 }, element:'ice', req:7, desc:'Dos filos finos como una noche clara.' },
  martillo_dorado:{ name:'Martillo dorado', kind:'weapon', slot:'main', price:320, tier:3,
    bonus:{ str:28, crit:3, wis:5, def:6 }, element:'holy', req:8, desc:'Sagrado y contundente a partes iguales.' },
  filo_vacio:{ name:'Filo del vacío', kind:'weapon', slot:'main', price:520, tier:4,
    bonus:{ str:36, crit:10, luck:8 }, element:'shadow', req:11, desc:'Corta cosas que no deberían poder cortarse.' },
  baculo_celeste:{ name:'Báculo celeste', kind:'weapon', slot:'main', price:540, tier:4,
    bonus:{ mag:40, mp:26, wis:12, int:8 }, element:'holy', req:11, desc:'Tallado en un hueso de estrella, dicen.' },
  aguja_tormenta:{ name:'Aguja de tormenta', kind:'weapon', slot:'main', price:500, tier:4,
    bonus:{ mag:36, crit:8, dex:7 }, element:'storm', req:11, desc:'Chisporrotea cuando mientes.' },

  tunica_lino:{ name:'Túnica de lino', kind:'armor', slot:'body', price:30, tier:1,
    bonus:{ def:2, con:2, hp:8 }, req:1, desc:'Mejor que nada, por poco.' },
  cuero_endurecido:{ name:'Cuero endurecido', kind:'armor', slot:'body', price:80, tier:1,
    bonus:{ def:5, con:4, hp:14 }, req:2, desc:'Curtido tres veces para durar.' },
  cota_malla:{ name:'Cota de malla', kind:'armor', slot:'body', price:160, tier:2,
    bonus:{ def:11, con:9, hp:26, dex:-1 }, req:4, desc:'Miles de anillos, cero comodidad.' },
  tunica_arcana:{ name:'Túnica arcana', kind:'armor', slot:'body', price:150, tier:2,
    bonus:{ def:6, con:5, mag:9, mp:16 }, req:4, desc:'Las runas del dobladillo repelen hechizos menores.' },
  placas_acero:{ name:'Placas de acero', kind:'armor', slot:'body', price:300, tier:3,
    bonus:{ def:20, con:17, hp:44, dex:-2 }, req:7, desc:'Una fortaleza con piernas.' },
  capa_sombras:{ name:'Capa de sombras', kind:'armor', slot:'body', price:280, tier:3,
    bonus:{ def:10, con:8, eva:9, dex:5 }, req:7, desc:'Quien la lleva decide cuándo le ven.' },
  tunica_estelar:{ name:'Túnica estelar', kind:'armor', slot:'body', price:330, tier:3,
    bonus:{ def:11, con:9, mag:16, mp:24 }, req:7, desc:'Tejida con hilo que refleja algo que no está ahí.' },
  armadura_dragon:{ name:'Armadura de dragón', kind:'armor', slot:'body', price:600, tier:4,
    bonus:{ def:30, con:26, hp:80, mag:10, dex:-3 }, req:11, desc:'Sigue estando caliente.' },

  capucha_tela:{ name:'Capucha de tela', kind:'armor', slot:'head', price:25, tier:1,
    bonus:{ def:1, mp:5, wis:2 }, req:1, desc:'Protege del sol y de las miradas.' },
  yelmo_hierro:{ name:'Yelmo de hierro', kind:'armor', slot:'head', price:95, tier:2,
    bonus:{ def:6, con:5, hp:14 }, req:4, desc:'Deja marca en la frente.' },
  diadema_arcana:{ name:'Diadema arcana', kind:'armor', slot:'head', price:110, tier:2,
    bonus:{ def:3, con:2, mag:10, crit:3 }, req:4, desc:'Enfoca el pensamiento hasta doler.' },
  corona_reyes:{ name:'Corona de los reyes olvidados', kind:'armor', slot:'head', price:420, tier:4,
    bonus:{ def:13, mag:16, hp:40, crit:5, wis:8 }, req:11, desc:'Pesada de llevar; pesada de merecer.' },

  anillo_bronce:{ name:'Anillo de bronce', kind:'acc', slot:'acc1', price:40, tier:1,
    bonus:{ str:3, hp:10 }, req:1, desc:'Un regalo, probablemente sincero.' },
  amuleto_hueso:{ name:'Amuleto de hueso', kind:'acc', slot:'acc1', price:70, tier:1,
    bonus:{ mag:5, mp:12, int:3 }, req:2, desc:'Protege de algo que nadie recuerda.' },
  pendiente_plata:{ name:'Pendiente de plata', kind:'acc', slot:'acc1', price:90, tier:2,
    bonus:{ eva:6, dex:5 }, req:3, desc:'Ligero hasta lo absurdo.' },
  anillo_vitalidad:{ name:'Anillo de vitalidad', kind:'acc', slot:'acc1', price:180, tier:3,
    bonus:{ hp:60, con:12 }, req:6, desc:'Late cuando tú te cansas.' },
  amuleto_critico:{ name:'Amuleto del verdugo', kind:'acc', slot:'acc1', price:220, tier:3,
    bonus:{ crit:15, luck:9, str:6 }, req:6, desc:'Encuentra los huecos de cualquier armadura.' },
  colgante_runico:{ name:'Colgante rúnico', kind:'acc', slot:'acc1', price:200, tier:3,
    bonus:{ mag:18, mp:20, int:5 }, req:6, desc:'Guarda hechizos sin usar.' },
  sello_aethel:{ name:'Sello de Aethel', kind:'acc', slot:'acc1', price:480, tier:4,
    bonus:{ str:10, dex:10, int:10, con:10, wis:10, luck:10, hp:50, mp:30, crit:6 }, req:12, desc:'El sello del que fue el primer rey. No hay otro igual.' },

  pocion_menor:{ name:'Poción menor', kind:'consumable', price:25, tier:1, stock:10,
    effect:{ heal:60 }, desc:'Restaura 60 de vida.' },
  pocion_mayor:{ name:'Poción mayor', kind:'consumable', price:70, tier:2, stock:6,
    effect:{ healPct:0.55 }, desc:'Restaura 55% de la vida máxima.' },
  elixir:{ name:'Elixir completo', kind:'consumable', price:150, tier:3, stock:3,
    effect:{ healFull:true, mpPct:1 }, desc:'Restaura toda la vida y todo el maná.' },
  ether:{ name:'Éter', kind:'consumable', price:55, tier:2, stock:6,
    effect:{ mp:50 }, desc:'Restaura 50 de maná.' },
  antidoto:{ name:'Antídoto', kind:'consumable', price:35, tier:1, stock:8,
    effect:{ cleanse:true }, desc:'Elimina todos los estados negativos.' },
  tonico_fuerza:{ name:'Tónico de fuerza', kind:'consumable', price:45, tier:1, stock:5,
    effect:{ status:[{ id:'might', turns:3, chance:1 }] }, desc:'Poderío durante 3 turnos.' },
  tonico_piel:{ name:'Tónico de piel de piedra', kind:'consumable', price:45, tier:1, stock:5,
    effect:{ status:[{ id:'guard', turns:3, chance:1 }] }, desc:'Guardia durante 3 turnos.' },
  hierba_regen:{ name:'Hierba de regeneración', kind:'consumable', price:60, tier:2, stock:5,
    effect:{ status:[{ id:'regen', turns:4, chance:1 }] }, desc:'Regeneración durante 4 turnos.' },
  bomba_fuego:{ name:'Bomba de fuego', kind:'consumable', price:65, tier:2, stock:4,
    effect:{ damage:80, element:'fire', all:true }, desc:'Daño de fuego a todos los enemigos.' },
  polvo_cegador:{ name:'Polvo cegador', kind:'consumable', price:50, tier:2, stock:4,
    effect:{ status:[{ id:'blind', turns:3, chance:0.9 }], all:true }, desc:'Ciega a todos los enemigos 3 turnos.' },
  pan_viajero:{ name:'Pan del viajero', kind:'consumable', price:15, tier:1, stock:10,
    effect:{ heal:35, mp:15 }, desc:'Recupera un poco de vida y maná.' },

  colmillo:{ name:'Colmillo', kind:'material', price:12, tier:1, desc:'Se vende bien en la capital.' },
  seda_sombria:{ name:'Seda sombría', kind:'material', price:28, tier:2, desc:'Fría aunque haga calor.' },
  cristal_arcano:{ name:'Cristal arcano', kind:'material', price:45, tier:2, desc:'Zumba si lo acercas al oído.' },
  escama_dragon:{ name:'Escama de dragón', kind:'material', price:120, tier:4, desc:'Casi imposible de rayar.' },
  esencia_vacia:{ name:'Esencia del vacío', kind:'material', price:200, tier:4, desc:'Mira fijamente hacia dentro.' },
  reliquia_rota:{ name:'Reliquia rota', kind:'material', price:60, tier:3, desc:'Queda algo dentro. Algo antiguo.' }
};
const ITEM_KEYS = Object.keys(ITEMS);

const AFFIXES = [
  { id:'atk',  name:'de furia',    weight:16, stats:{ str:4 } },
  { id:'def',  name:'de muro',     weight:16, stats:{ def:4, con:3 } },
  { id:'mag',  name:'del vidente', weight:14, stats:{ mag:5, int:3 } },
  { id:'hp',   name:'del oso',     weight:18, stats:{ hp:22 } },
  { id:'crit', name:'del verdugo', weight:10, stats:{ crit:5, luck:4 } },
  { id:'eva',  name:'del humo',    weight:10, stats:{ eva:5, dex:3 } },
  { id:'spd',  name:'del viento',  weight:10, stats:{ dex:4 } },
  { id:'mp',   name:'del pozo',    weight:10, stats:{ mp:16 } },
  { id:'all',  name:'del héroe',   weight:3,  stats:{ str:3, con:3, int:3, hp:12 } }
];

/* -------------------------------- ENEMIGOS -------------------------------- */
const ENEMIES = {
  rata_gigante:{ name:'Rata gigante', tier:1, sprite:'rat', tags:['beast'],
    hp:34, atk:9, def:4, mag:2, crit:3, eva:6,
    rewards:{ xp:14, gold:9 }, drops:[{ item:'colmillo', chance:0.3 }],
    skills:[{ id:'mordisco', power:1.2 }] },

  lodo_vivo:{ name:'Lodo vivo', tier:1, sprite:'slime', tags:['beast'],
    hp:52, atk:8, def:7, mag:4, crit:2, eva:2, element:'neutral',
    resist:{ neutral:0.75 }, rewards:{ xp:18, gold:11 },
    drops:[{ item:'colmillo', chance:0.2 }, { item:'pocion_menor', chance:0.15 }],
    skills:[{ id:'golpe_limo', power:1.1 }, { id:'rociar_acido', power:1.3, element:'neutral', apply:[{ id:'poison', turns:3, chance:0.4 }] }] },

  goblin:{ name:'Goblin saqueador', tier:1, sprite:'goblin', tags:['humanoid'],
    hp:44, atk:11, def:5, mag:3, crit:8, eva:10,
    rewards:{ xp:20, gold:16 }, drops:[{ item:'daga_oxidada', chance:0.12 }, { item:'pocion_menor', chance:0.2 }],
    skills:[{ id:'punalada', power:1.4 }, { id:'grito_goblin', power:0, apply:[{ id:'might', turns:2, chance:1 }], self:true }] },

  arana_sombria:{ name:'Araña sombría', tier:1, sprite:'spider', tags:['beast'],
    hp:40, atk:12, def:4, mag:5, crit:10, eva:14, element:'shadow',
    rewards:{ xp:24, gold:14 }, drops:[{ item:'seda_sombria', chance:0.3 }, { item:'antidoto', chance:0.15 }],
    skills:[{ id:'mordida_venenosa', power:1.2, apply:[{ id:'poison', turns:4, chance:0.6 }] },
            { id:'telarana', power:0.5, apply:[{ id:'slow', turns:3, chance:0.85 }] }] },

  lobo_negro:{ name:'Lobo negro', tier:2, sprite:'wolf', tags:['beast'],
    hp:88, atk:20, def:11, mag:5, crit:12, eva:12,
    rewards:{ xp:42, gold:30 }, drops:[{ item:'colmillo', chance:0.4 }, { item:'hierba_regen', chance:0.1 }],
    skills:[{ id:'mordida_desgarradora', power:1.6, apply:[{ id:'bleed', turns:3, chance:0.5 }] },
            { id:'aullido', power:0, apply:[{ id:'haste', turns:3, chance:1 }], self:true }] },

  esqueleto_guerrero:{ name:'Esqueleto guerrero', tier:2, sprite:'skeleton', tags:['undead'],
    hp:96, atk:19, def:16, mag:4, crit:6, eva:6, element:'shadow',
    weak:{ holy:1.6, fire:1.2 }, resist:{ shadow:0.5 },
    rewards:{ xp:46, gold:34 }, drops:[{ item:'reliquia_rota', chance:0.12 }, { item:'pocion_menor', chance:0.25 }],
    skills:[{ id:'tajo_oseo', power:1.5 }, { id:'escudo_oseo', power:0, apply:[{ id:'guard', turns:2, chance:1 }], self:true }] },

  bandido:{ name:'Bandido de los caminos', tier:2, sprite:'bandit', tags:['humanoid'],
    hp:90, atk:22, def:12, mag:5, crit:16, eva:13,
    rewards:{ xp:48, gold:55 }, drops:[{ item:'pocion_menor', chance:0.3 }, { item:'daga_sombria', chance:0.08 }],
    skills:[{ id:'doble_ataque', power:0.95, hits:2 },
            { id:'polvo_cegador_e', power:0.8, apply:[{ id:'blind', turns:2, chance:0.7 }] }] },

  golem_piedra:{ name:'Gólem de piedra', tier:2, sprite:'golem', tags:['construct'],
    hp:140, atk:21, def:26, mag:6, crit:3, eva:2,
    resist:{ neutral:0.7, fire:0.8 }, weak:{ storm:1.5 },
    rewards:{ xp:58, gold:36 }, drops:[{ item:'reliquia_rota', chance:0.15 }, { item:'pocion_mayor', chance:0.12 }],
    skills:[{ id:'punetazo_piedra', power:1.7 }, { id:'salva_rocas', power:1.1, all:true }] },

  mago_rencoroso:{ name:'Mago rencoroso', tier:2, sprite:'darkmage', tags:['humanoid'],
    hp:78, atk:9, def:10, mag:26, crit:8, eva:9, element:'arcane',
    rewards:{ xp:60, gold:60 }, drops:[{ item:'cristal_arcano', chance:0.35 }, { item:'ether', chance:0.25 }],
    skills:[{ id:'saeta_arcana', power:1.7, element:'arcane' },
            { id:'onda_congelante', power:1.3, element:'ice', all:true, apply:[{ id:'slow', turns:2, chance:0.5 }] },
            { id:'escudo_mago', power:0, apply:[{ id:'barrier', turns:2, chance:1, power:0.4 }], self:true }] },

  troll_cuevas:{ name:'Troll de las cuevas', tier:3, sprite:'troll', tags:['beast'],
    hp:230, atk:34, def:22, mag:6, crit:8, eva:5, element:'neutral',
    regenTurn:0.03, weak:{ fire:1.6 }, rewards:{ xp:110, gold:80 },
    drops:[{ item:'pocion_mayor', chance:0.3 }, { item:'escama_dragon', chance:0.05 }],
    skills:[{ id:'mazazo', power:1.8 }, { id:'golpe_temblor', power:1.3, all:true },
            { id:'regenerar_troll', power:0, self:true, healSelf:0.22 }] },

  nigromante:{ name:'Nigromante', tier:3, sprite:'necromancer', tags:['humanoid','undead'],
    hp:180, atk:12, def:16, mag:38, crit:9, eva:10, element:'shadow',
    weak:{ holy:1.7 }, resist:{ shadow:0.4 }, rewards:{ xp:130, gold:95 },
    drops:[{ item:'esencia_vacia', chance:0.2 }, { item:'cristal_arcano', chance:0.4 }],
    skills:[{ id:'drenaje_alma', power:1.8, element:'shadow', drain:0.5 },
            { id:'nube_putrida', power:1.4, element:'shadow', all:true, apply:[{ id:'poison', turns:3, chance:0.7 }] },
            { id:'maldicion', power:1.2, element:'shadow', apply:[{ id:'weaken', turns:3, chance:0.8 }] },
            { id:'invocar_esqueleto', summon:'esqueleto_guerrero' }] },

  draconido:{ name:'Dracónido de ceniza', tier:3, sprite:'draconid', tags:['dragon'],
    hp:260, atk:38, def:28, mag:20, crit:11, eva:7, element:'fire',
    resist:{ fire:0.4 }, weak:{ ice:1.6 }, rewards:{ xp:150, gold:110 },
    drops:[{ item:'escama_dragon', chance:0.22 }, { item:'pocion_mayor', chance:0.3 }],
    skills:[{ id:'aliento_igneo', power:1.6, element:'fire', all:true, apply:[{ id:'burn', turns:3, chance:0.6 }] },
            { id:'garra_trituradora', power:2.0 }] },

  caballero_caido:{ name:'Caballero caído', tier:3, sprite:'darkknight', tags:['undead','humanoid'],
    hp:240, atk:36, def:34, mag:10, crit:10, eva:6, element:'shadow',
    weak:{ holy:1.6 }, resist:{ neutral:0.8, shadow:0.5 }, rewards:{ xp:145, gold:120 },
    drops:[{ item:'placas_acero', chance:0.07 }, { item:'reliquia_rota', chance:0.3 }],
    skills:[{ id:'golpe_oscuro', power:1.9, element:'shadow', apply:[{ id:'bleed', turns:3, chance:0.5 }] },
            { id:'postura_defensiva', power:0, apply:[{ id:'guard', turns:3, chance:1 }, { id:'might', turns:3, chance:1 }], self:true }] },

  espectro:{ name:'Espectro', tier:4, sprite:'wraith', tags:['undead'],
    hp:280, atk:20, def:24, mag:52, crit:14, eva:20, element:'shadow',
    weak:{ holy:1.8, arcane:1.3 }, resist:{ shadow:0.3, neutral:0.7 }, rewards:{ xp:230, gold:170 },
    drops:[{ item:'esencia_vacia', chance:0.35 }, { item:'elixir', chance:0.15 }],
    skills:[{ id:'toque_gelido', power:2.0, element:'ice', apply:[{ id:'slow', turns:3, chance:0.7 }] },
            { id:'alarido', power:1.5, element:'shadow', all:true, apply:[{ id:'weaken', turns:3, chance:0.8 }] },
            { id:'desvanecerse', power:0, self:true, apply:[{ id:'haste', turns:2, chance:1 }, { id:'focus', turns:2, chance:1 }] }] },

  rey_goblins:{ name:'Rey Goblin Grukk', tier:2, boss:true, sprite:'goblinKing', tags:['humanoid','boss'],
    hp:420, atk:26, def:18, mag:8, crit:12, eva:8, element:'neutral',
    rewards:{ xp:220, gold:260 }, drops:[{ item:'hacha_mano', chance:1 }, { item:'pocion_mayor', chance:1 }, { item:'anillo_vitalidad', chance:0.4 }],
    skills:[{ id:'tajo_real', power:1.8 }, { id:'llamada_clan', summon:'goblin' },
            { id:'furia_real', power:0, self:true, apply:[{ id:'might', turns:3, chance:1 }, { id:'haste', turns:3, chance:1 }] }] },

  guardiana_bosque:{ name:'Guardiana del Bosque Umbrío', tier:2, boss:true, sprite:'dryad', tags:['boss'],
    hp:500, atk:24, def:22, mag:34, crit:10, eva:14, element:'neutral',
    weak:{ fire:1.5 }, resist:{ neutral:0.8 }, rewards:{ xp:260, gold:280 },
    drops:[{ item:'hierba_regen', chance:1 }, { item:'tunica_arcana', chance:0.35 }, { item:'colgante_runico', chance:0.3 }],
    skills:[{ id:'espinas', power:1.7, element:'neutral', apply:[{ id:'bleed', turns:3, chance:0.7 }] },
            { id:'polen_dorado', power:1.4, element:'holy', all:true, apply:[{ id:'blind', turns:2, chance:0.6 }] },
            { id:'abrazo_raices', power:0.9, element:'neutral', apply:[{ id:'stun', turns:1, chance:0.55 }] }] },

  senor_ceniza:{ name:'Señor de la Ceniza Ignar', tier:3, boss:true, sprite:'ashLord', tags:['dragon','boss'],
    hp:900, atk:42, def:32, mag:40, crit:12, eva:9, element:'fire',
    resist:{ fire:0.3 }, weak:{ ice:1.7 }, rewards:{ xp:420, gold:480 },
    drops:[{ item:'vara_infernal', chance:0.4 }, { item:'escama_dragon', chance:1 }, { item:'pocion_mayor', chance:1 }],
    skills:[{ id:'erupcion', power:2.2, element:'fire', all:true, apply:[{ id:'burn', turns:4, chance:0.8 }] },
            { id:'lanzallamas', power:2.4, element:'fire' },
            { id:'alas_ceniza', power:1.6, element:'neutral', all:true },
            { id:'corona_brasas', power:0, self:true, apply:[{ id:'might', turns:3, chance:1 }, { id:'barrier', turns:3, chance:1, power:0.3 }] }] },

  rey_vacio:{ name:'Rey del Vacío', tier:4, boss:true, final:true, sprite:'voidKing', tags:['undead','demon','boss'],
    hp:1600, atk:52, def:42, mag:62, crit:16, eva:16, element:'shadow',
    resist:{ shadow:0.2, neutral:0.6 }, weak:{ holy:1.6 }, rewards:{ xp:1200, gold:900 },
    drops:[{ item:'sello_aethel', chance:1 }, { item:'elixir', chance:1 }, { item:'esencia_vacia', chance:1 }],
    skills:[{ id:'marea_nihil', power:2.4, element:'shadow', all:true, apply:[{ id:'weaken', turns:3, chance:0.7 }] },
            { id:'guadana_final', power:3.0, element:'shadow', apply:[{ id:'bleed', turns:4, chance:0.8 }] },
            { id:'sello_negro', power:1.8, element:'shadow', apply:[{ id:'silence', turns:3, chance:0.8 }] },
            { id:'devorar_almas', power:2.2, element:'shadow', drain:0.6 },
            { id:'ejercito_muerto', summon:'espectro' },
            { id:'voluntad_vacio', power:0, self:true, apply:[{ id:'haste', turns:3, chance:1 }, { id:'guard', turns:3, chance:1 }, { id:'regen', turns:3, chance:1 }] }] }
};

/* ---------------------------------- ZONAS --------------------------------- */
const ZONES = {
  aldea_inicio:{ id:'aldea_inicio', name:'Aldea de Robledal', safe:true, order:0, reqLevel:1,
    desc:'Un puñado de casas, un herrero terco y una posada que huele a guiso. Aquí empieza todo.',
    innCost:10, theme:'aldea',
    shop:['pocion_menor','pan_viajero','ether','daga_oxidada','espada_corta','baston_aprendiz','tunica_lino','capucha_tela','anillo_bronce'] },

  bosque_umbrio:{ id:'bosque_umbrio', name:'Bosque Umbrío', safe:false, order:1, reqLevel:1,
    desc:'Árboles que no dejan pasar la luz y algo que respira entre las raíces.',
    theme:'bosque', encounter:0.55, innCost:25, unlock:null,
    encounters:['rata_gigante','lodo_vivo','goblin','arana_sombria','lobo_negro'],
    weights:[30,26,22,14,8], boss:'guardiana_bosque' },

  ruinas_qarim:{ id:'ruinas_qarim', name:'Ruinas de Qarim', safe:false, order:2, reqLevel:3,
    desc:'Lo que queda de una ciudad que se tragó su propia magia.',
    theme:'ruinas', encounter:0.58, innCost:40, unlock:'ruinas_qarim',
    encounters:['esqueleto_guerrero','bandido','lobo_negro','golem_piedra','mago_rencoroso','arana_sombria'],
    weights:[24,22,16,14,14,10], boss:'rey_goblins' },

  cienaga_podrida:{ id:'cienaga_podrida', name:'Ciénaga Podrida', safe:false, order:3, reqLevel:6,
    desc:'El agua está quieta y caliente, y no debería estarlo.',
    theme:'cienaga', encounter:0.60, innCost:60, unlock:'cienaga_podrida',
    encounters:['lodo_vivo','troll_cuevas','nigromante','esqueleto_guerrero','arana_sombria','golem_piedra'],
    weights:[18,20,18,14,12,10], boss:'guardiana_bosque' },

  ciudad_bajo:{ id:'ciudad_bajo', name:'Ciudad de Bajo Mercado', safe:true, order:4, reqLevel:6,
    desc:'Aquí todo se compra, todo se vende y nada se pregunta.',
    innCost:80, theme:'ciudad', unlock:'ciudad_bajo',
    shop:['pocion_mayor','ether','antidoto','hierba_regen','bomba_fuego','tonico_fuerza','cuero_endurecido','cota_malla','yelmo_hierro','daga_sombria','varita_roble','diadema_arcana','pendiente_plata','amuleto_hueso'] },

  picos_ceniza:{ id:'picos_ceniza', name:'Picos de Ceniza', safe:false, order:5, reqLevel:9,
    desc:'Montañas que arden por dentro. El aire quema al respirar.',
    theme:'volcan', encounter:0.62, innCost:90, unlock:'picos_ceniza',
    encounters:['draconido','troll_cuevas','nigromante','caballero_caido','golem_piedra','mago_rencoroso'],
    weights:[24,18,16,18,12,12], boss:'senor_ceniza' },

  abismo_vacio:{ id:'abismo_vacio', name:'Abismo del Vacío', safe:false, order:6, reqLevel:13,
    desc:'No hay suelo. Hay algo que hace de suelo. No mires demasiado.',
    theme:'vacio', encounter:0.65, innCost:120, unlock:'abismo_vacio',
    encounters:['espectro','caballero_caido','nigromante','draconido','troll_cuevas'],
    weights:[32,22,18,14,14], boss:'rey_vacio' }
};

/* --------------------------------- MISIONES ------------------------------- */
const QUESTS = [
  { id:'mision_01', name:'El susurro del bosque', giver:'Anciana Mirta', zone:'aldea_inicio', reqLevel:1,
    desc:'Los lobos bajan al pueblo desde que algo se movió en el Bosque Umbrío. Ve, mira qué pasa y vuelve con pruebas.',
    kind:'kill', target:'lobo_negro', count:3, rewards:{ xp:120, gold:80, items:['pocion_menor','pocion_menor'] }, unlocks:'ruinas_qarim' },
  { id:'mision_02', name:'La guardiana', giver:'Anciana Mirta', zone:'bosque_umbrio', reqLevel:3,
    desc:'Lo que se movió en el bosque tiene nombre y corona de ramas. Encuéntrala y acaba con ella.',
    kind:'boss', target:'guardiana_bosque', count:1, rewards:{ xp:340, gold:220, items:['pocion_mayor','cristal_arcano'] }, unlocks:'cienaga_podrida' },
  { id:'mision_03', name:'Piedras que hablan', giver:'Viejo Fausto', zone:'ruinas_qarim', reqLevel:4,
    desc:'Los esqueletos de Qarim llevan una reliquia colgada. Trae tres y sabremos qué despertó.',
    kind:'collect', target:'reliquia_rota', count:3, rewards:{ xp:280, gold:260, items:['amuleto_hueso','pocion_mayor'] }, unlocks:'ciudad_bajo' },
  { id:'mision_04', name:'El rey de tres dientes', giver:'Viejo Fausto', zone:'ruinas_qarim', reqLevel:5,
    desc:'Grukk reunió a los goblins de las ruinas. Si no lo paras hoy, mañana serán un ejército.',
    kind:'boss', target:'rey_goblins', count:1, rewards:{ xp:420, gold:340, items:['cota_malla','pocion_mayor'] }, unlocks:'ciudad_bajo' },
  { id:'mision_05', name:'Agua que no corre', giver:'Mercader Otón', zone:'cienaga_podrida', reqLevel:7,
    desc:'Algo está metiendo cadáveres en la ciénaga para que vuelvan a caminar. Corta la fuente.',
    kind:'kill', target:'nigromante', count:4, rewards:{ xp:520, gold:380, items:['colgante_runico','ether','ether'] }, unlocks:'picos_ceniza' },
  { id:'mision_06', name:'Raíces retorcidas', giver:'Mercader Otón', zone:'cienaga_podrida', reqLevel:9,
    desc:'La guardiana no murió, solo se marchitó. Ha vuelto, y ahora el agua le pertenece.',
    kind:'boss', target:'guardiana_bosque', count:1, rewards:{ xp:680, gold:420, items:['tunica_estelar','pocion_mayor'] }, unlocks:'picos_ceniza' },
  { id:'mision_07', name:'Ceniza en la garganta', giver:'Capitana Reva', zone:'picos_ceniza', reqLevel:10,
    desc:'Los dracónidos están despertando a algo bajo la montaña. Baja su número antes de que terminen.',
    kind:'kill', target:'draconido', count:5, rewards:{ xp:760, gold:520, items:['espada_runa','pocion_mayor'] }, unlocks:'abismo_vacio' },
  { id:'mision_08', name:'El señor de la ceniza', giver:'Capitana Reva', zone:'picos_ceniza', reqLevel:12,
    desc:'Ignar lleva mil años dormido y ha decidido que ya es suficiente. Despiértalo del todo o duérmelo para siempre.',
    kind:'boss', target:'senor_ceniza', count:1, rewards:{ xp:1100, gold:700, items:['armadura_dragon','elixir'] }, unlocks:'abismo_vacio' },
  { id:'mision_09', name:'Caballeros huecos', giver:'Espectro Aliado', zone:'abismo_vacio', reqLevel:14,
    desc:'Los caballeros caídos guardan esencia del Vacío. Necesitas tres para abrir la puerta.',
    kind:'collect', target:'esencia_vacia', count:3, rewards:{ xp:1200, gold:800, items:['colgante_runico','elixir'] }, unlocks:'abismo_vacio' },
  { id:'mision_10', name:'El Rey del Vacío', giver:'Espectro Aliado', zone:'abismo_vacio', reqLevel:16,
    desc:'Aethel no cayó por una guerra. Cayó porque alguien abrió una puerta y no la cerró. Ciérrala.',
    kind:'boss', target:'rey_vacio', count:1, rewards:{ xp:3000, gold:1500, items:['sello_aethel','elixir'] }, unlocks:null }
];

const EVENTS = [
  { id:'cofre', name:'Cofre olvidado', desc:'Un cofre con la cerradura rota. Dentro hay algo que tintinea.' },
  { id:'altar', name:'Altar en ruinas', desc:'Un altar gastado. Todavía acepta ofrendas.' },
  { id:'mercader', name:'Mercader ambulante', desc:'Un mercader con una mula nerviosa y precios de urgencia.' },
  { id:'emboscada', name:'Emboscada', desc:'Salen de detrás de todo a la vez.' },
  { id:'fuente', name:'Fuente de maná', desc:'Un chorro de agua azul imposible.' },
  { id:'santuario', name:'Santuario bendito', desc:'Una piedra con un símbolo de luz apenas visible.' },
  { id:'mineral', name:'Veta de mineral', desc:'Brilla entre la roca suelta.' }
];

const export_ = (typeof module !== 'undefined' && module.exports) ? module.exports : (root.AETH = root.AETH || {});
export_.ELEMENTS = ELEMENTS;
export_.ELEM_TABLE = ELEM_TABLE;
export_.STATUS = STATUS;
export_.STATUS_KEYS = STATUS_KEYS;
export_.CLASSES = CLASSES;
export_.CLASS_KEYS = CLASS_KEYS;
export_.SKILLS = SKILLS;
export_.SKILL_TREE = SKILL_TREE;
export_.skillsForClass = skillsForClass;
export_.nextSkillUnlock = nextSkillUnlock;
export_.RARITY = RARITY;
export_.RARITY_KEYS = RARITY_KEYS;
export_.ITEMS = ITEMS;
export_.ITEM_KEYS = ITEM_KEYS;
export_.AFFIXES = AFFIXES;
export_.ENEMIES = ENEMIES;
export_.ZONES = ZONES;
export_.QUESTS = QUESTS;
export_.EVENTS = EVENTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
