/**
 * Generador de un archivo único autocontenido.
 *
 * Toma la capa de datos, el motor, el adaptador y la interfaz, los une en el
 * orden correcto y produce una página `dist/aethel.html` con todo dentro: se
 * puede copiar a cualquier sitio y abrir con doble clic, sin servidor.
 *
 * Uso:
 *   node tools/build-single-file.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const html = read('index.html');
const scripts = ['js/data.js', 'js/engine.js', 'js/ui.js', 'js/game.js'];
const bundle = scripts.map(f => `/* ===== ${f} ===== */\n` + read(f)).join('\n');

const inline = html.replace(
  /\n<script src="js\/data\.js"><\/script>\n<script src="js\/engine\.js"><\/script>\n<script src="js\/ui\.js"><\/script>\n<script src="js\/game\.js"><\/script>/,
  '\n<script>\n' + bundle + '</script>'
);

if (inline === html) {
  console.error('No se encontraron las etiquetas script esperadas en index.html.');
  process.exit(1);
}

const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'aethel.html'), inline, 'utf8');
console.log('Escrito dist/aethel.html — ' + Math.round(inline.length / 1024) + ' KB');
