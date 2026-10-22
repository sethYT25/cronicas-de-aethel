# Crónicas de Aethel

RPG por turnos completo, escrito en JavaScript puro. **Sin dependencias, sin compilación y sin servidor:**
todo el juego son cuatro archivos `js/*.js` más un `index.html` con los estilos.

Abre `index.html` en el navegador y ya está. También funciona servido desde cualquier hosting estático.

---

## Qué incluye

**Mundo y progresión**

- Seis regiones encadenadas: el Bosque Umbrío, las Ruinas de Qarim, la Ciénaga Podrida, la Ciudad de Bajo Mercado,
  los Picos de Ceniza y el Abismo del Vacío. Cada una se abre al completar la misión anterior.
- Diez misiones con tres tipos de objetivo: cazar criaturas, reunir objetos y derribar jefes.
- Mazmorras generadas por procedimiento: de 9 a 13 salas por nivel de profundidad, con combates, cofres,
  cámaras de descanso y un jefe al final. La profundidad sube cada dos jefes derrotados.
- Cuatro jefes con patrones propios, entre ellos el Rey del Vacío, el combate final.

**Combate**

- Turnos por iniciativa, con reordenación de la ronda completa.
- Fórmula de daño con atenuación logarítmica de la defensa, críticos, evasión, guardia y vulnerabilidad.
- Siete elementos con debilidades y resistencias por criatura: fuego, hielo, tormenta, arcano, sagrado, sombra y neutro.
- Quince estados alterados: veneno, quemadura, hemorragia, aturdimiento, ralentización, debilitamiento,
  vulnerabilidad, ceguera, silencio, regeneración, celeridad, poderío, guardia, barrera y concentración.
- Enemigos con hechizos, curación propia, posturas defensivas y huida imposible contra los jefes.

**Personajes**

- Cuatro clases con estadísticas, curvas de crecimiento y habilidades distintas: Guerrero, Maga, Pícara y Clériga.
- Cuarenta habilidades repartidas en cuatro árboles, con rangos, coste creciente de maná y desbloqueo por nivel.
- Sesenta objetos entre armas, armaduras, cascos, accesorios, consumibles y materiales.
- Botín con cinco rarezas y nueve afijos aleatorios, que escalan las estadísticas y el valor de venta.
- Tienda, posada, compra, venta, equipo por ranuras y uso de consumibles dentro y fuera del combate.

**Interfaz y presentación**

- Mapa navegable con nodos bloqueados hasta cumplir el nivel y la misión.
- Pantalla de combate con tarjetas de unidad, barra de turnos, registro narrado y menús de habilidad y objeto.
- Diario de misiones, ficha de personaje, inventario y tres ranuras de guardado con autoguardado.
- Música y efectos generados por síntesis en vivo con la Web Audio API: tres ambientes (mapa, combate, jefes)
  y avisos de golpe, crítico, curación, subida de nivel y derrota. Se silencia con la tecla **M**.

---

## Controles

| Tecla | Acción |
|---|---|
| `←` `↑` `→` `↓` o `W A S D` | Moverse por los menús |
| `Enter` o `Espacio` | Elegir |
| `Esc` | Volver atrás |
| `I` | Inventario |
| `C` | Ficha de personaje |
| `M` | Silenciar o activar la música |

Durante el combate, `←` y `→` cambian de objetivo cuando no hay un submenú abierto.

---

## Estructura

```
index.html        Marcado, estilos y carga de los scripts
js/data.js        Contenido declarativo: elementos, estados, clases, habilidades,
                  objetos, enemigos, zonas, misiones y eventos
js/engine.js      Motor puro: fórmulas, combate, exploración, mazmorras y guardado
js/ui.js          Adaptador: traduce los datos al formato del motor y añade
                  misiones, botín con rareza, comercio y recompensas
js/game.js        Pantallas, entrada, combate interactivo y música por síntesis
tests/harness.js  Arnés de pruebas del motor
```

El motor no toca el DOM. Se puede ejecutar sin navegador, y de hecho así se prueba.

---

## Pruebas

Con Node instalado:

```bash
node tests/harness.js
```

El arnés siembra el generador aleatorio para que los resultados sean reproducibles y comprueba dieciséis rutas:
integridad de los datos, fórmula de daño y elementos, iniciativa, estados, curva de experiencia, habilidades,
tienda y botín con rareza, combate completo, combates contra jefes, generación y recorrido de mazmorras,
exploración de ochocientos pasos, ciclo de misiones, guardado fiel, una partida simulada de cuatro mil pasos,
rendimiento y una prueba de cobertura que ejecuta **todas** las habilidades de las cuatro clases.

---

## Cómo está construido

El proyecto se organiza en cuatro capas con una dirección de dependencia única: `data.js` describe el contenido
sin lógica, `engine.js` define las reglas y nunca consulta la interfaz, `ui.js` traduce los efectos declarativos
al formato que consumen las fórmulas y añade el contenido derivado (misiones, rarezas, tienda), y `game.js`
solo presenta y recoge la intención del jugador.

### Detalles de diseño

- **Aleatoriedad sembrable.** Toda tirada pasa por `E.RNG`, con un generador determinista activable mediante
  `E.RNG.seed(n)`. Es lo que permite que las pruebas de cuatro mil pasos den siempre el mismo resultado.
- **Fórmula de daño con rendimientos decrecientes.** El daño se atenúa con `1 - def / (def + 55)`, de modo que
  una defensa alta nunca anula un golpe y el escalado no se rompe en niveles altos.
- **Guardado como texto.** `E.stringifySave` devuelve una cadena y `E.parseSave` la restaura comprobando versión.
- **Música sin archivos.** El intervalo de composición recorre tres escalas (una por ambiente) con bajo, arpegio,
  percusión y fraseo ocasional.

---

## Guardado

Tres ranuras en `localStorage`, más autoguardado después de cada victoria, misión entregada o mazmorra completada.
Si la partida termina en derrota, se puede continuar desde la aldea perdiendo la mitad del oro.

---

## Estado del proyecto

El motor está cubierto por el arnés y se ejecutó sobre simulaciones largas antes de publicarse. La interfaz
se escribió siguiendo las mismas interfaces que prueban esas suites, pero **no se ha ejecutado en un navegador
real desde este entorno**: si algo se ve raro al abrirlo, es ahí donde estará el problema.

## Licencia

MIT.
