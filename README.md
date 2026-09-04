# Mapa de viviendas turísticas y herramientas para inquilinas

Sitio estático del Sindicato de Inquilinas e Inquilinos de Cádiz en `mapa.inquilinatocadiz.org`. Astro 7 + Tailwind 4 + Leaflet. Sin backend: todo se calcula en el navegador y nada de lo que escribe la gente sale de su equipo.

## Qué hay

- `/` Mapa de viviendas de uso turístico y apartamentos turísticos de Cádiz con buscador por calle, filtros por tipo, código postal y titular empresa.
- `/datos/` Cifras: totales, plazas, por código postal, altas por año y empresas con más alojamientos.
- `/denuncia/` Cómo denunciar una vivienda turística ilegal.
- `/herramientas/` Calculadora de actualización de renta (IRAV/IPC), calculadora de plazos LAU, comprobador de cláusulas del contrato y guía del precio de referencia.

## Datos

Fuente: [OpenRTA](https://www.juntadeandalucia.es/datosabiertos/portal/dataset/openrta), el Registro de Turismo de Andalucía en datos abiertos (CC BY 4.0, actualización diaria).

`npm run data` ejecuta `scripts/fetch-openrta.mjs`: descarga los registros del municipio de Cádiz, se queda con viviendas de uso turístico y apartamentos turísticos, **elimina email y teléfonos**, reproyecta las coordenadas de EPSG:25830 a WGS84, descarta las que caen fuera del término municipal y escribe `public/data/vut-cadiz.geojson` y `src/data/stats.json`.

Sobre los titulares: la Junta publica el nombre sólo cuando es una empresa; las personas físicas llegan anonimizadas y así se quedan. No se guarda ni se publica ningún dato de contacto.

El workflow `update-data.yml` regenera los datos el día 1 de cada mes y hace commit si hay cambios; `deploy.yml` construye y publica en GitHub Pages con cada push a `main`.

`src/data/indices.json` guarda los últimos valores conocidos de IPC e IRAV para la calculadora de renta. La calculadora siempre permite escribir el valor a mano y enlaza al INE.

## Desarrollo

```sh
npm install
npm run data      # opcional: regenerar datos
npm run dev
npm run check     # tipos
npm run build
```

## Despliegue

GitHub Pages desde Actions. El dominio `mapa.inquilinatocadiz.org` necesita un registro CNAME en Cloudflare apuntando a `inquilinato-cadiz.github.io` (modo DNS only o proxied, ambos funcionan) y el fichero `public/CNAME` ya está.

## Origen

El mapa parte de la idea y del código de [Cádiz Resiste](https://github.com/cadiz-resiste/cadiz-resiste-web). Los datos se regeneran desde la fuente oficial en lugar de reutilizar su volcado de 2024.
