# Mapa de viviendas turísticas y herramientas para inquilinas

Sitio estático del Sindicato de Inquilinas e Inquilinos de Cádiz en `mapa.inquilinatocadiz.org`. Astro 7 + Tailwind 4 + Leaflet. Sin backend: todo se calcula en el navegador y nada de lo que escribe la gente sale de su equipo.

## Qué hay

- `/` Mapa de viviendas de uso turístico y apartamentos turísticos de Cádiz con buscador por calle, filtros por tipo, código postal y titular empresa.
- `/datos/` Cifras: totales, plazas, por código postal, altas por año y empresas con más alojamientos.
- `/denuncia/` Cómo denunciar una vivienda turística ilegal.
- `/utilidades/` Calculadora de actualización de renta (IRAV/IPC), calculadora de plazos LAU, comprobador de cláusulas del contrato y guía del precio de referencia.

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

## Despliegue y operación

- **GitHub Pages desde Actions** (`.github/workflows/deploy.yml`): cada push a `main` construye y publica. El repo es público porque Pages en el plan gratuito lo exige.
- **Dominio**: `mapa.inquilinatocadiz.org` con `CNAME → inquilinato-cadiz.github.io` en Cloudflare (DNS only) y `public/CNAME`. Certificado de GitHub emitido y HTTPS forzado (Settings → Pages). Si el certificado se atasca, quitar y volver a poner el dominio en Settings → Pages.
- **Datos**: `update-data.yml` corre el día 1 de cada mes a las 05:17 UTC; también a mano en Actions → "Actualizar datos" → Run workflow. Si OpenRTA cambia el formato, el script falla y no hay commit: los datos anteriores siguen publicados.
- **Enlaces desde la web**: menú Herramientas de inquilinatocadiz.org (Mapa, Datos, Utilidades, Denunciar). La sección se llamó `/herramientas/` en la primera versión; hay redirecciones.
- **Índices para la calculadora de renta**: `src/data/indices.json`, a mano. El IRAV lo publica el INE mensualmente y la calculadora siempre permite escribirlo.

## Origen

El mapa parte de la idea y del código de [Cádiz Resiste](https://github.com/cadiz-resiste/cadiz-resiste-web). Los datos se regeneran desde la fuente oficial en lugar de reutilizar su volcado de 2024.
