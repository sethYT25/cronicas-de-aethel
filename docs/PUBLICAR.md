# Publicar el juego en línea

El juego funciona tal cual desde el repositorio, sin ninguna configuración. Estas son las tres formas de
ponerlo en una dirección, de la más sencilla a la más automática.

## 1. GitHub Pages desde la rama principal

En los ajustes del repositorio: **Pages → Source → Deploy from a branch → main / (root)**. En un par de minutos
queda publicado en `https://<usuario>.github.io/cronicas-de-aethel/`.

No hace falta preparar nada más: el `index.html` está en la raíz y carga la carpeta `js`, así que el sitio funciona
sin tocar nada.

## 2. Cualquier otro hosting estático

Sube `index.html` y la carpeta `js`. Es todo. Sirve para Netlify, Cloudflare Pages, Vercel, un servidor propio
con nginx o un simple `python3 -m http.server`.

## 3. Un único archivo

Si prefieres un solo archivo sin carpeta adjunta:

```bash
node tools/build-single-file.js
```

Produce `dist/aethel.html` con el juego completo dentro. Se puede enviar por correo, copiar a una memoria o
abrir con doble clic sin servidor.

## Con integración continua

`tools/pages.yml` contiene un flujo listo para usar: comprueba el motor con `node tests/harness.js` y publica el
sitio. Para activarlo, cópialo a `.github/workflows/pages.yml` y activa Pages con origen **GitHub Actions**.
Se deja en `tools/` porque crear flujos de trabajo de acciones requiere permisos de administración sobre el
repositorio.
