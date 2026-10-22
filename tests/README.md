# Pruebas

El arnés del motor se puede ejecutar de dos formas.

## En Node

```bash
node tests/harness.js
```

Sale un resumen por suite y el recuento de comprobaciones. Devuelve código de salida 1 si algo falla, así que
sirve tal cual en un flujo de integración continua.

## En el navegador

Abre `tests/index.html`. Carga la capa de datos, el motor, el adaptador y el arnés, lo ejecuta al abrir la página
y muestra el resultado en pantalla.

## Qué se comprueba

1. Integridad de la capa de datos: clases, habilidades, objetos, enemigos, zonas y misiones, y que cada referencia
   entre ellos apunte a algo que existe.
2. Fórmula de daño: valores positivos y acotados, y multiplicadores elementales de debilidad y resistencia.
3. Iniciativa y orden de turnos entre clases.
4. Estados alterados: aplicación, daño por turno y caducidad.
5. Experiencia, subida de nivel y crecimiento de estadísticas.
6. Habilidades: coste de maná, curación, daño en área y limpieza de estados.
7. Tienda: compra, equipo por ranuras, venta y distribución de rarezas en el botín.
8. Combate completo resuelto por la IA.
9. Combate contra jefes y la imposibilidad de huir de ellos.
10. Generación y recorrido completo de mazmorras en cuatro profundidades.
11. Exploración de ochocientos pasos sin fallos en el estado del mundo.
12. Ciclo de misiones: aceptar, progresar, entregar y desbloquear la siguiente zona.
13. Guardado y restauración fiel, incluido el rechazo de partidas corruptas.
14. Partida completa simulada de cuatro mil pasos con todos los sistemas en juego.
15. Rendimiento: doscientos combates completos en menos de seis segundos.
16. Cobertura: todas las habilidades de las cuatro clases se ejecutan y narran su efecto.
