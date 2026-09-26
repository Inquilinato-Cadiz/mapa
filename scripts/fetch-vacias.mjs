#!/usr/bin/env node
// Descarga del INE (API Tempus3, tabla 59531 «Viviendas según su intensidad de
// uso», Censo 2021) las viviendas de cada municipio de la provincia de Cádiz
// clasificadas por su consumo eléctrico anual y escribe src/data/vacias.json.
//   vacías          sin contrato o consumo inferior al de 15 días de uso al año
//   bajo consumo    hasta 250 kWh
//   uso esporádico  entre 251 y 750 kWh
// Es una foto a 1 de enero de 2021: no cambia hasta el próximo censo.
// Uso: node scripts/fetch-vacias.mjs
import { readFile, writeFile } from "node:fs/promises";

const API = "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/59531?nult=1";
const FIELDS = {
  "Viviendas totales": "total",
  "Viviendas vacías": "empty",
  "Viviendas con bajo consumo": "low",
  "Viviendas de uso esporádico": "sporadic",
  "Mediana consumo anual": "median_kwh",
};

// «Puerto de Santa María (El)» → «el puerto de santa maria», sin acentos.
const ALIASES = { zahara: "zahara de la sierra" };
const norm = (name) =>
  name
    .replace(/^(.*) \((El|La|Los|Las)\)$/u, "$2 $1")
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

const out = {};
let province = null;
const warned = new Set();
for (const s of series) {
  const m = s.Nombre.match(/^(11\d{3}|11) (.+?), (.+)$/);
  if (!m) continue;
  const [, code, name, field] = m;
  const key = FIELDS[field];
  if (!key) continue;
  const value = s.Data?.[0]?.Valor ?? null;
  if (code === "11") {
    if (name !== "Cádiz") continue; // «11 Galicia» es la comunidad autónoma 11
    province ??= { name: "Provincia de Cádiz" };
    province[key] = value;
    continue;
  }
  const slug = bySlug.get(norm(name));
  if (!slug) {
    if (code !== "11999") warned.add(`${code} ${name}`);
    continue;
  }
  out[slug] ??= { ine: code, name };
  out[slug][key] = value;
}

for (const w of warned) console.warn(`Sin correspondencia: ${w}`);
// El INE agrupa los municipios más pequeños en «Resto de Cádiz»: se quedan sin dato.
const missing = municipios.filter((m) => !out[m.slug]).map((m) => m.name);
if (missing.length) console.warn(`Sin dato del INE (agrupados en «Resto de Cádiz»): ${missing.join(", ")}`);

await writeFile(
  new URL("../src/data/vacias.json", import.meta.url),
  JSON.stringify(
    {
      source: "INE, Censo de Población y Viviendas 2021. Viviendas según su intensidad de uso (tabla 59531), a partir del consumo eléctrico anual",
      source_url: "https://www.ine.es/jaxi/Tabla.htm?tpx=59531&L=0",
      reference_date: "2021-01-01",
      generated_at: new Date().toISOString().slice(0, 10),
      province,
      missing,
      municipios: out,
    },
    null,
    2,
  ) + "\n",
);
console.log(`${Object.keys(out).length} municipios. Provincia: ${province.empty} vacías de ${province.total}. Cádiz: ${out.cadiz.empty} de ${out.cadiz.total}.`);
