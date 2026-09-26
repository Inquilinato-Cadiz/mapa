#!/usr/bin/env node
// Descarga del INE (API Tempus3, tabla 2864: cifras oficiales de población de
// los municipios de la provincia de Cádiz, revisión del padrón) los habitantes
// de cada municipio y escribe src/data/poblacion.json. El INE la actualiza una
// vez al año (diciembre) con los datos a 1 de enero.
// Uso: node scripts/fetch-poblacion.mjs
import { readFile, writeFile } from "node:fs/promises";

const API = "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/2864?nult=1";

const ALIASES = { zahara: "zahara de la sierra" };
const norm = (name) =>
  name
    .replace(/^(.*) \((El|La|Los|Las)\)$/u, "$2 $1")
    .replace(/^(.*), (El|La|Los|Las)$/u, "$2 $1")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(.+)$/, (m) => ALIASES[m] ?? m);

const { municipios } = JSON.parse(await readFile(new URL("../src/data/municipios.json", import.meta.url), "utf8"));
const bySlug = new Map(municipios.map((m) => [norm(m.name), m.slug]));

const res = await fetch(API);
if (!res.ok) throw new Error(`INE: HTTP ${res.status}`);
const series = await res.json();

let province = null;
let year = null;
const out = {};
for (const s of series) {
  const m = s.Nombre.match(/^(.+?)\. Total\. Total habitantes/);
  if (!m) continue;
  const value = s.Data?.[0]?.Valor;
  year ??= s.Data?.[0]?.Anyo ?? null;
  // La primera serie «Cádiz» es la provincia; la ciudad viene después.
  if (province === null && m[1] === "Cádiz") {
    province = value;
    continue;
  }
  const slug = bySlug.get(norm(m[1]));
  if (!slug) {
    console.warn(`Sin correspondencia: ${m[1]}`);
    continue;
  }
  out[slug] = value;
}
const missing = municipios.filter((m) => !(m.slug in out)).map((m) => m.name);
if (missing.length) throw new Error(`Faltan municipios: ${missing.join(", ")}`);

await writeFile(
  new URL("../src/data/poblacion.json", import.meta.url),
  JSON.stringify(
    {
      source: "INE, cifras oficiales de población de los municipios (revisión del padrón municipal), tabla 2864",
      source_url: "https://www.ine.es/jaxiT3/Tabla.htm?t=2864",
      year,
      generated_at: new Date().toISOString().slice(0, 10),
      province,
      municipios: out,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Padrón ${year}: provincia ${province} habitantes, Cádiz ${out.cadiz}. ${Object.keys(out).length} municipios.`);
