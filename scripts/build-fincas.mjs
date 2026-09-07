#!/usr/bin/env node
// Convierte data/fincas-cadiz.csv (fincas de la ciudad de Cádiz sin división
// horizontal, es decir, edificios enteros de un único propietario, con 5 o más
// viviendas según el Catastro) en:
//   public/data/fincas-cadiz.geojson  (lo carga el mapa de /fincas/)
//   src/data/fincas.json              (cifras para la página)
//
// El CSV se exporta a mano desde el Excel que prepara el grupo de datos del
// sindicato; para quitar una finca basta borrar su fila y volver a ejecutar.
//
// Uso: node scripts/build-fincas.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";

const SOURCE = "data/fincas-cadiz.csv";
const MIN_HOMES = 5;
const THRESHOLDS = [5, 10, 20, 50, 100];

const text = await readFile(SOURCE, "utf8");
const [header, ...lines] = text.trim().split(/\r?\n/);
if (text.includes('"')) throw new Error(`${SOURCE}: hay comillas; el CSV debe ser plano, sin campos entrecomillados`);
const cols = header.split(",");
const rows = lines.filter(Boolean).map((line) => Object.fromEntries(line.split(",").map((v, i) => [cols[i], v.trim()])));

// El Catastro escribe las calles en mayúsculas: «CONDE O'REILLY», «ESPAÑA DE».
const SMALL = new Set(["de", "del", "la", "las", "los", "el", "y"]);
const titleCase = (s) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/(^|')\p{L}/gu, (c) => c.toUpperCase())))
    .join(" ");

const features = rows
  .map((r) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [Number(r.lon), Number(r.lat)] },
    properties: {
      ref: r.referencia_catastral,
      address: `${titleCase(r.calle)}, ${r.numero}`,
      postal_code: /^11\d{3}$/.test(r.codigo_postal) ? r.codigo_postal : null,
      homes: Number(r.viviendas),
      area: Number(r.superficie_construida_m2) || null,
      year: Number(r.anyo_construccion) || null,
    },
  }))
  .filter((f) => f.properties.homes >= MIN_HOMES && f.geometry.coordinates.every(Number.isFinite))
  .sort((a, b) => b.properties.homes - a.properties.homes || a.properties.address.localeCompare(b.properties.address, "es"));

const refs = new Set(features.map((f) => f.properties.ref));
if (refs.size !== features.length) throw new Error("Referencias catastrales repetidas en el CSV");

const byPostalCode = {};
for (const f of features) {
  const k = f.properties.postal_code ?? "sin dato";
  byPostalCode[k] ??= { fincas: 0, viviendas: 0 };
  byPostalCode[k].fincas++;
  byPostalCode[k].viviendas += f.properties.homes;
}

const generatedAt = new Date().toISOString().slice(0, 10);
const stats = {
  generated_at: generatedAt,
  source: "Dirección General del Catastro",
  min_homes: MIN_HOMES,
  total: features.length,
  homes: features.reduce((s, f) => s + f.properties.homes, 0),
  thresholds: Object.fromEntries(THRESHOLDS.map((t) => [t, features.filter((f) => f.properties.homes >= t).length])),
  by_postal_code: byPostalCode,
};

await mkdir("public/data", { recursive: true });
await mkdir("src/data", { recursive: true });
await writeFile("public/data/fincas-cadiz.geojson", JSON.stringify({ type: "FeatureCollection", generated_at: generatedAt, features }));
await writeFile("src/data/fincas.json", JSON.stringify(stats, null, 2) + "\n");
console.log(`${stats.total} fincas · ${stats.homes} viviendas · ${Object.keys(byPostalCode).length} códigos postales`);
