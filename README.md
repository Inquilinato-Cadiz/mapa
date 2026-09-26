# inquilinatocadiz.org

Web del Sindicato de Inquilinas e Inquilinos de Cádiz: portada, agenda, mapa de viviendas turísticas, datos de vivienda y utilidades para inquilinas. Sitio estático con Astro 7 + Tailwind 4 + Leaflet. Sin backend: todo se calcula en el navegador y nada de lo que escribe la gente sale de su equipo.

## Qué hay

Es la web del Sindicato de Inquilinas e Inquilinos de Cádiz (`inquilinatocadiz.org`), un sitio estático hecho con Astro. Sustituye al WordPress anterior.

- `/` Portada: quiénes somos, cifras del mapa, próximas convocatorias, participa y vídeo.
- `/participa/`, `/agenda/`, `/unete/` y `/aviso-legal-y-privacidad/` Páginas del sindicato. La agenda se carga en el navegador desde `sindicadas.inquilinatocadiz.org/agenda.json`; si no responde, enlaza a la agenda de Sindicadas.
- `/mapa/` Mapa de viviendas de uso turístico y apartamentos turísticos de los 45 municipios de la provincia de Cádiz: selector de municipio, buscador por calle y filtros por tipo, código postal y titular empresa. `/mapa/?m=tarifa` abre un municipio; `&cp=11380` filtra un código postal.
- `/fincas/` Mapa de las fincas de la ciudad de Cádiz que pertenecen enteras a un único propietario (sin división horizontal) con 5 o más viviendas, con buscador por calle y filtros por tamaño y código postal. Llamada a organizarse con las vecinas.
- `/datos/` Cifras de la provincia y ranking por municipio; `/datos/<municipio>/` para cada uno: totales, plazas, por código postal, altas por año y empresas con más alojamientos.
- `/denuncia/` Cómo denunciar una vivienda turística ilegal.
- `/utilidades/` Calculadora de actualización de renta (IRAV/IPC), calculadora de plazos LAU, comprobador de cláusulas del contrato y guía del precio de referencia.

Diseño: Anton para titulares, bordes negros y sombras duras, animaciones en CSS que respetan `prefers-reduced-motion`. Los vídeos de YouTube no cargan nada de Google hasta que se pulsan (`youtube-nocookie.com`). En desarrollo, `PUBLIC_AGENDA_SOURCE=http://localhost:3000/agenda.json` apunta la agenda a un Sindicadas local.

## Datos

Fuente: [OpenRTA](https://www.juntadeandalucia.es/datosabiertos/portal/dataset/openrta), el Registro de Turismo de Andalucía en datos abiertos (CC BY 4.0, actualización diaria).

`npm run data` ejecuta `scripts/fetch-openrta.mjs`: pide a la API los registros de cada uno de los 45 municipios de la provincia (la API no pagina y corta en 10.000, y ningún municipio se acerca), se queda con viviendas de uso turístico y apartamentos turísticos, **elimina email y teléfonos**, reproyecta las coordenadas de EPSG:25830 a WGS84, descarta las que caen fuera de la provincia o a más de 30 km del centro de su municipio y escribe un `public/data/municipios/<slug>.geojson` por municipio (el mapa carga sólo el elegido), el índice `src/data/municipios.json` y las cifras `src/data/stats.json`. Tarda unos dos minutos.

Sobre los titulares: la Junta publica el nombre sólo cuando es una empresa; las personas físicas llegan anonimizadas y así se quedan. No se guarda ni se publica ningún dato de contacto.

El workflow `update-data.yml` regenera los datos y los índices el día 1 de cada mes y hace commit si hay cambios; `deploy.yml` construye y publica en GitHub Pages con cada push a `main`.

### Fincas de un único propietario

Fuente: Dirección General del Catastro, extraído y filtrado por el grupo de datos del sindicato (fincas sin división horizontal con 5 o más viviendas en la ciudad de Cádiz). No hay API: el dato llega en un Excel.

`data/fincas-cadiz.csv` es ese Excel exportado a CSV UTF-8 con estas columnas: `referencia_catastral, calle, numero, codigo_postal, lat, lon, superficie_construida_m2, anyo_construccion, viviendas`. `npm run fincas` ejecuta `scripts/build-fincas.mjs`, que escribe `public/data/fincas-cadiz.geojson` (lo carga el mapa) y `src/data/fincas.json` (cifras para la página). Para quitar una finca (por ejemplo, una promoción de vivienda pública) basta borrar su fila del CSV y volver a ejecutar. El Catastro no dice quién es el propietario, sólo que es uno.

### Viviendas vacías

Fuente: INE, Censo de Población y Viviendas 2021, tabla 59531 «Viviendas según su intensidad de uso»: cada vivienda clasificada por su consumo eléctrico anual (vacía, bajo consumo, uso esporádico). `npm run vacias` ejecuta `scripts/fetch-vacias.mjs`, que descarga la tabla por la API del INE, se queda con los municipios de la provincia y escribe `src/data/vacias.json`. Es una foto a 1 de enero de 2021 y no cambia hasta el próximo censo, así que no va en el workflow mensual. El INE no publica el detalle de Benaocaz, Torre Alháquime y Villaluenga del Rosario (los agrupa en «Resto de Cádiz»).

### Demanda de vivienda protegida

Fuente: Junta de Andalucía, estadística mensual de los Registros Municipales de Demandantes de Vivienda Protegida (fichero «Solicitudes y estado de inscripciones a origen»). `npm run demanda` ejecuta `scripts/fetch-demanda.mjs`, que busca en la web de la Junta el Excel del último mes, se queda con los municipios de la provincia y escribe `src/data/demanda.json`: solicitudes, inscripciones, activas (familias que esperan), adjudicadas y caducadas. Sólo aparecen los municipios que usan la herramienta común de la Junta; los que llevan registro propio quedan fuera y se listan en `missing`. Se regenera cada mes en `update-data.yml`; si la Junta cambia el formato, el script falla y se conserva el dato anterior.

### Desahucios

Fuente: Consejo General del Poder Judicial, Estadística Judicial, «Efecto de la crisis en los órganos judiciales», series por provincias: lanzamientos practicados por trimestre desde 2013, separados en alquiler (LAU), ejecución hipotecaria y otros. `npm run desahucios` ejecuta `scripts/fetch-desahucios.mjs`, que localiza en la página del CGPJ el Excel del último trimestre (el nombre cambia cada vez), lee las cuatro hojas de lanzamientos, se queda con la fila de Cádiz y escribe `src/data/desahucios.json` con las series, los totales por año, el último año completo y los últimos cuatro trimestres. Sólo hay dato provincial. Se regenera cada mes en `update-data.yml`; el CGPJ publica cada trimestre con dos o tres meses de retraso.

`src/data/indices.json` guarda los valores mensuales de IPC e IRAV para la calculadora de renta. `npm run indices` ejecuta `scripts/fetch-indices.mjs`, que los descarga de la API del INE (series IPC290750 e IRAV1). La calculadora siempre permite escribir el valor a mano y enlaza al INE.

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
- **Dominio**: `inquilinatocadiz.org` (raíz) en `public/CNAME`. En Cloudflare (DNS only), cuatro registros `A` a las IPs de GitHub Pages (185.199.108-111.153) y `CNAME www → inquilinato-cadiz.github.io`. El dominio se fija en Settings → Pages (o `gh api -X PUT repos/Inquilinato-Cadiz/mapa/pages -f cname=…`): con despliegue por Actions, el fichero CNAME no lo cambia. El subdominio `mapa.inquilinatocadiz.org` (2026-09-04 a 2026-09-26) se dio de baja sin redirección. Certificado de GitHub emitido y HTTPS forzado (Settings → Pages). Si el certificado se atasca, quitar y volver a poner el dominio en Settings → Pages.
- **Datos**: `update-data.yml` corre el día 1 de cada mes a las 05:17 UTC; también a mano en Actions → "Actualizar datos" → Run workflow. Si OpenRTA cambia el formato, el script falla y no hay commit: los datos anteriores siguen publicados.
- **Redirecciones**: `/herramientas/*` (nombre de la primera versión) y `/afiliate/` (URL del WordPress) están en `astro.config.mjs`.
- **Desahucios**: `src/data/desahucios.json`, regenerado por `update-data.yml` con `npm run desahucios`. Si el CGPJ cambia el nombre de las hojas, el script falla y se conserva el dato anterior.
- **Demanda de vivienda protegida**: `src/data/demanda.json`, regenerado por `update-data.yml` con `npm run demanda`. La Junta publica cada mes con uno o dos de retraso.
- **Índices para la calculadora de renta**: `src/data/indices.json`, regenerado por `update-data.yml` con `npm run indices`. El INE publica el IRAV y el IPC a mediados de mes, así que el día 1 se recoge el del mes anterior; la calculadora siempre permite escribir el valor a mano.
- **Estadísticas**: Umami en `estadisticas.inquilinatocadiz.org` (servidor de Sindicadas, ver `sindicadas/docs/OPERACIONES.md`). El script va en `src/layouts/Base.astro`; sin cookies ni datos personales.
- **Sin terceros**: la fuente Anton (`@fontsource/anton`) y Font Awesome (`@fortawesome/fontawesome-free`) se sirven desde el propio sitio, importados en `src/styles/global.css`. Ninguna visita carga nada de Google ni de un CDN.

## Origen

El mapa parte de la idea y del código de [Cádiz Resiste](https://github.com/cadiz-resiste/cadiz-resiste-web). Los datos se regeneran desde la fuente oficial en lugar de reutilizar su volcado de 2024.
