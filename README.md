# Mapa de viviendas turísticas y herramientas para inquilinas

Sitio estático del Sindicato de Inquilinas e Inquilinos de Cádiz en `mapa.inquilinatocadiz.org`. Astro 7 + Tailwind 4 + Leaflet. Sin backend: todo se calcula en el navegador y nada de lo que escribe la gente sale de su equipo.

## Qué hay

- `/` Mapa de viviendas de uso turístico y apartamentos turísticos de los 45 municipios de la provincia de Cádiz: selector de municipio, buscador por calle y filtros por tipo, código postal y titular empresa. `/?m=tarifa` abre un municipio; `&cp=11380` filtra un código postal.
- `/fincas/` Mapa de las fincas de la ciudad de Cádiz que pertenecen enteras a un único propietario (sin división horizontal) con 5 o más viviendas, con buscador por calle y filtros por tamaño y código postal. Llamada a organizarse con las vecinas.
- `/datos/` Cifras de la provincia y ranking por municipio; `/datos/<municipio>/` para cada uno: totales, plazas, por código postal, altas por año y empresas con más alojamientos.
- `/denuncia/` Cómo denunciar una vivienda turística ilegal.
- `/utilidades/` Calculadora de actualización de renta (IRAV/IPC), calculadora de plazos LAU, comprobador de cláusulas del contrato y guía del precio de referencia.

## Datos

Fuente: [OpenRTA](https://www.juntadeandalucia.es/datosabiertos/portal/dataset/openrta), el Registro de Turismo de Andalucía en datos abiertos (CC BY 4.0, actualización diaria).

`npm run data` ejecuta `scripts/fetch-openrta.mjs`: pide a la API los registros de cada uno de los 45 municipios de la provincia (la API no pagina y corta en 10.000, y ningún municipio se acerca), se queda con viviendas de uso turístico y apartamentos turísticos, **elimina email y teléfonos**, reproyecta las coordenadas de EPSG:25830 a WGS84, descarta las que caen fuera de la provincia o a más de 30 km del centro de su municipio y escribe un `public/data/municipios/<slug>.geojson` por municipio (el mapa carga sólo el elegido), el índice `src/data/municipios.json` y las cifras `src/data/stats.json`. Tarda unos dos minutos.

Sobre los titulares: la Junta publica el nombre sólo cuando es una empresa; las personas físicas llegan anonimizadas y así se quedan. No se guarda ni se publica ningún dato de contacto.

El workflow `update-data.yml` regenera los datos el día 1 de cada mes y hace commit si hay cambios; `deploy.yml` construye y publica en GitHub Pages con cada push a `main`.

### Fincas de un único propietario

Fuente: Dirección General del Catastro, extraído y filtrado por el grupo de datos del sindicato (fincas sin división horizontal con 5 o más viviendas en la ciudad de Cádiz). No hay API: el dato llega en un Excel.

`data/fincas-cadiz.csv` es ese Excel exportado a CSV UTF-8 con estas columnas: `referencia_catastral, calle, numero, codigo_postal, lat, lon, superficie_construida_m2, anyo_construccion, viviendas`. `npm run fincas` ejecuta `scripts/build-fincas.mjs`, que escribe `public/data/fincas-cadiz.geojson` (lo carga el mapa) y `src/data/fincas.json` (cifras para la página). Para quitar una finca (por ejemplo, una promoción de vivienda pública) basta borrar su fila del CSV y volver a ejecutar. El Catastro no dice quién es el propietario, sólo que es uno.

`src/data/indices.json` guarda los últimos valores conocidos de IPC e IRAV para la calculadora de renta. La calculadora siempre permite escribir el valor a mano y enlaza al INE.

## Desarrollo

```sh
npm install
npm run data      # opcional: regenerar datos
npm run dev
npm run check     # tipos
npm run build
```

## Despliegue y operación

- **GitHub Pages desde Actions** (`.github/workflows/deploy.yml`): cada push a `main` construye y publica. El repo es público porque Pages en el plan gratuito lo exige.
- **Dominio**: `mapa.inquilinatocadiz.org` con `CNAME → inquilinato-cadiz.github.io` en Cloudflare (DNS only) y `public/CNAME`. Certificado de GitHub emitido y HTTPS forzado (Settings → Pages). Si el certificado se atasca, quitar y volver a poner el dominio en Settings → Pages.
- **Datos**: `update-data.yml` corre el día 1 de cada mes a las 05:17 UTC; también a mano en Actions → "Actualizar datos" → Run workflow. Si OpenRTA cambia el formato, el script falla y no hay commit: los datos anteriores siguen publicados.
- **Enlaces desde la web**: menú Herramientas de inquilinatocadiz.org (Mapa, Datos, Utilidades, Denunciar). La sección se llamó `/herramientas/` en la primera versión; hay redirecciones.
- **Índices para la calculadora de renta**: `src/data/indices.json`, a mano. El IRAV lo publica el INE mensualmente y la calculadora siempre permite escribirlo.
- **Estadísticas**: Umami en `estadisticas.inquilinatocadiz.org` (servidor de Sindicadas, ver `sindicadas/docs/OPERACIONES.md`). El script va en `src/layouts/Base.astro`; sin cookies ni datos personales.
- **Sin terceros**: la fuente Anton (`@fontsource/anton`) y Font Awesome (`@fortawesome/fontawesome-free`) se sirven desde el propio sitio, importados en `src/styles/global.css`. Ninguna visita carga nada de Google ni de un CDN.

## Origen

El mapa parte de la idea y del código de [Cádiz Resiste](https://github.com/cadiz-resiste/cadiz-resiste-web). Los datos se regeneran desde la fuente oficial en lugar de reutilizar su volcado de 2024.
