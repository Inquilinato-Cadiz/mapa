#!/usr/bin/env node
// Descarga de la Junta de Andalucía la estadística mensual de los Registros
// Municipales de Demandantes de Vivienda Protegida (fichero rmdvp01,
// «Solicitudes y estado de inscripciones a origen»), se queda con los
// municipios de la provincia de Cádiz y escribe src/data/demanda.json:
//   solicitudes   presentadas desde 2009
//   inscritas     inscripciones a origen
//   activas       inscripciones vigentes: familias que esperan una vivienda
//   adjudicadas   inscripciones canceladas por adjudicación
//   caducadas     caducadas y otros
// Sólo aparecen los municipios que usan la herramienta común de la Junta:
// Jerez y algún otro llevan registro propio y quedan fuera (se anotan).
// Uso: node scripts/fetch-demanda.mjs
import { readFile, writeFile } from "node:fs/promises";
import XLSX from "xlsx";

const BASE = "https://www.juntadeandalucia.es";
const PAGE = (year) => `${BASE}/organismos/viviendajuventudyordenaciondelterritorio/areas/vivienda-rehabilitacion/vivienda-protegida/paginas/rmdv-estadistica-mensual-${year}.html`;
const UA = { headers: { "User-Agent": "Mozilla/5.0 (inquilinatocadiz.org; datos abiertos)" } };

const norm = (name) =>
  name
    .replace(/^(.*) \((El|La|Los|Las)\)$/u, "$2 $1")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Último Excel rmdvp01 publicado: se miran las páginas del año en curso y del anterior.
async function latestFile() {
  const year = new Date().getFullYear();
  const found = [];
  for (const y of [year, year - 1]) {
    const res = await fetch(PAGE(y), UA);
    if (!res.ok) continue;
    const html = await res.text();
    for (const m of html.matchAll(/href="([^"]*\/(\d{6})_rmdvp01_[^"]*\.xls)"/g)) found.push({ period: m[2], url: new URL(m[1], BASE).href });
    if (found.length) break;
  }
  if (!found.length) throw new Error("No se encuentra ningún fichero rmdvp01 en la web de la Junta");
  return found.sort((a, b) => b.period.localeCompare(a.period))[0];
}

const { municipios } = JSON.parse(await readFile(new URL("../src/data/municipios.json", import.meta.url), "utf8"));
const bySlug = new Map(municipios.map((m) => [norm(m.name), m.slug]));

const file = await latestFile();
const res = await fetch(file.url, UA);
if (!res.ok) throw new Error(`${file.url}: HTTP ${res.status}`);
const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });

const out = {};
const province = { solicitudes: 0, inscritas: 0, activas: 0, adjudicadas: 0, caducadas: 0 };
for (const raw of rows) {
  const r = raw.map((x) => String(x).trim()).filter(Boolean);
  if (r[0] !== "CÁDIZ" || r.length < 8) continue;
  const [, name, ine, ...nums] = r;
  const [solicitudes, inscritas, activas, adjudicadas, caducadas] = nums.slice(0, 5).map(Number);
  const slug = bySlug.get(norm(name));
  if (!slug) {
    console.warn(`Sin correspondencia: ${ine} ${name}`);
    continue;
  }
  // Sin inscripciones en la herramienta (aunque haya solicitudes) el registro se lleva fuera, como en Jerez: sin dato.
  if (!inscritas) continue;
  out[slug] = { ine, name, solicitudes, inscritas, activas, adjudicadas, caducadas };
  for (const k of Object.keys(province)) province[k] += out[slug][k];
}

const missing = municipios.filter((m) => !out[m.slug]).map((m) => m.name);
if (missing.length) console.warn(`Sin dato (registro propio o sin inscripciones): ${missing.join(", ")}`);
if (!out.cadiz) throw new Error("Falta Cádiz: ¿ha cambiado el formato del Excel?");

const period = `${file.period.slice(0, 4)}-${file.period.slice(4)}`;
await writeFile(
  new URL("../src/data/demanda.json", import.meta.url),
  JSON.stringify(
    {
      source: "Junta de Andalucía, Registros Municipales de Demandantes de Vivienda Protegida: solicitudes y estado de inscripciones a origen",
      source_url: PAGE(file.period.slice(0, 4)),
      file_url: file.url,
      period,
      generated_at: new Date().toISOString().slice(0, 10),
      province: { ...province, municipios: Object.keys(out).length },
      missing,
      municipios: out,
    },
    null,
    2,
  ) + "\n",
);
console.log(`${period}: ${Object.keys(out).length} municipios. Provincia: ${province.activas} inscripciones activas. Cádiz: ${out.cadiz.activas} activas, ${out.cadiz.adjudicadas} adjudicadas.`);
