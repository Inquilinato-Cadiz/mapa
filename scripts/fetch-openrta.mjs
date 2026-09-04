#!/usr/bin/env node
// Descarga del Registro de Turismo de Andalucía (OpenRTA, CC BY 4.0) las
// viviendas de uso turístico y apartamentos turísticos del municipio de Cádiz,
// quita los datos de contacto, reproyecta las coordenadas a WGS84 y escribe:
//   public/data/vut-cadiz.geojson  (lo carga el mapa)
//   src/data/stats.json            (cifras para la página de datos)
//
// Uso: node scripts/fetch-openrta.mjs
import { writeFile, mkdir } from "node:fs/promises";
import proj4 from "proj4";

const API = "https://datos.juntadeandalucia.es/api/v0/openrta";
const MUNICIPALITY = "CÁDIZ";
const TYPES = { "Vivienda de uso turístico": "VUT", "Apartamento turístico": "AT" };
const UTM30 = "+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";

const params = new URLSearchParams({
  id: "-", object_type: "-", category: "-", group: "-", modality: "-",
  province: MUNICIPALITY, municipality: MUNICIPALITY,
  order_by: "registration_code", mode: "ASC", format: "json", size: "10000",
});

const [payload, lastUpdate] = await Promise.all([
  fetch(`${API}/search?${params}`).then((r) => r.json()),
  fetch(`${API}/search/lastUpdateData`).then((r) => r.json()).catch(() => null),
]);

const rows = payload.results ?? [];
if (rows.length === 0) throw new Error("OpenRTA no devolvió registros");

const toDate = (s) => (s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);

// Titulares: la Junta ya anonimiza a las personas físicas ("-"); sólo llegan nombres de empresas.
const holderCounts = new Map();
for (const r of rows) {
  const h = (r.holder ?? "").trim();
  if (h && h !== "-") holderCounts.set(h, (holderCounts.get(h) ?? 0) + 1);
}

const features = [];
let skipped = 0;
for (const r of rows) {
  const type = TYPES[r.objects_type_id];
  if (!type) continue;
  // Las coordenadas llegan como texto y casi siempre con coma decimal.
  const num = (v) => Number(String(v ?? "").replace(",", "."));
  const x = num(r.coord_x), y = num(r.coord_y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0 || String(r.srid) !== "25830") { skipped++; continue; }
  const [lng, lat] = proj4(UTM30, "EPSG:4326", [x, y]);
  // Fuera del término municipal de Cádiz: coordenadas erróneas en el registro.
  if (lat < 36.44 || lat > 36.56 || lng < -6.33 || lng > -6.19) { skipped++; continue; }
  const holder = (r.holder ?? "").trim();
  const isCompany = holder && holder !== "-";
  features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))] },
    properties: {
      id: r.registration_code,
      type,
      group: r.group ?? null,
      address: [r.establishment_address, r.floor && `piso ${r.floor}`, r.door && `puerta ${r.door}`].filter(Boolean).join(", "),
      postal_code: r.postal_code ?? null,
      places: r.tot_gen_places ?? null,
      units: r.tot_gen_ua ?? null,
      registered: toDate(r.registration_date),
      catastro: r.catastral_ref ?? null,
      holder: isCompany ? holder : null,
      holder_count: isCompany ? holderCounts.get(holder) : null,
    },
  });
}

const count = (arr, key) => {
  const m = new Map();
  for (const f of arr) { const k = key(f) ?? "sin dato"; m.set(k, (m.get(k) ?? 0) + 1); }
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
};
const generatedAt = new Date().toISOString().slice(0, 10);
const stats = {
  generated_at: generatedAt,
  source_updated_at: lastUpdate?.date?.slice(0, 10) ?? null,
  total: features.length,
  skipped_without_valid_coordinates: skipped,
  places: features.reduce((s, f) => s + (f.properties.places ?? 0), 0),
  by_type: count(features, (f) => f.properties.type),
  by_group: count(features, (f) => f.properties.group),
  by_postal_code: count(features, (f) => f.properties.postal_code),
  by_year: Object.fromEntries(Object.entries(count(features, (f) => f.properties.registered?.slice(0, 4))).sort()),
  companies: [...holderCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, n]) => ({ name, count: n })),
  individuals_count: features.filter((f) => !f.properties.holder).length,
};

await mkdir("public/data", { recursive: true });
await mkdir("src/data", { recursive: true });
await writeFile("public/data/vut-cadiz.geojson", JSON.stringify({ type: "FeatureCollection", generated_at: generatedAt, features }));
await writeFile("src/data/stats.json", JSON.stringify(stats, null, 2) + "\n");
console.log(`${features.length} alojamientos (${skipped} sin coordenadas válidas) · ${stats.places} plazas · fuente actualizada ${stats.source_updated_at}`);
