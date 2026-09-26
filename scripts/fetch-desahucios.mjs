#!/usr/bin/env node
// Descarga del CGPJ (Estadística Judicial, «Efecto de la crisis en los órganos
// judiciales», series por provincias) los lanzamientos practicados en la
// provincia de Cádiz, por trimestre desde 2013 y por tipo:
//   lau          procedimientos de la Ley de Arrendamientos Urbanos: alquiler
//   hipotecaria  ejecuciones hipotecarias
//   otros        otros procedimientos (precario, ocupación…)
// Escribe src/data/desahucios.json con las series, los totales por año y el
// último año completo. El nombre del Excel cambia cada trimestre: se busca en
// la página el enlace «Series … por provincias».
// Uso: node scripts/fetch-desahucios.mjs
import { writeFile } from "node:fs/promises";
import XLSX from "xlsx";

const BASE = "https://www.poderjudicial.es";
const PAGE = `${BASE}/cgpj/es/Temas/Estadistica-Judicial/Estudios-e-Informes/Efecto-de-la-Crisis-en-los-organos-judiciales/`;
const UA = { headers: { "User-Agent": "Mozilla/5.0 (inquilinatocadiz.org; datos abiertos)" } };
const SHEETS = {
  total: /^Lanzamientos pract\. Total prov/i,
  hipotecaria: /^Lanzamientos E\.hipotecaria prov/i,
  lau: /^Lanzamientos L\.A\.U\. prov/i,
  otros: /^Lanzamientos\.? Otros prov/i,
};
const PROVINCE = /^C[AÁ]DIZ$/i;
const ANDALUCIA = ["ALMERIA", "CADIZ", "CORDOBA", "GRANADA", "HUELVA", "JAEN", "MALAGA", "SEVILLA"];
const plain = (s) => String(s).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const QUARTER = /^(\d{2})-+T(\d)/;

const page = await fetch(PAGE, UA);
if (!page.ok) throw new Error(`CGPJ: HTTP ${page.status}`);
const html = await page.text();
const links = [...html.matchAll(/href="([^"]*Series[^"]*por provincias[^"]*\.xlsx[^"]*)"/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
if (!links.length) throw new Error("No se encuentra el Excel «Series … por provincias» en la página del CGPJ");
const fileUrl = new URL(links[0], BASE).href;

const res = await fetch(fileUrl, UA);
if (!res.ok) throw new Error(`${fileUrl}: HTTP ${res.status}`);
const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });

// Fila de cabecera con «13-T1, 13-T2…» y fila de la provincia pedida, en la columna que sea.
function series(sheetName, province = "CADIZ") {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
  const header = rows.find((r) => r.filter((c) => QUARTER.test(String(c).trim())).length >= 4);
  const row = rows.find((r) => r.some((c) => plain(c) === province));
  if (!header || !row) throw new Error(`${sheetName}: no encuentro la cabecera o la fila de ${province}`);
  const out = {};
  header.forEach((cell, i) => {
    const m = String(cell).trim().match(QUARTER);
    if (!m) return;
    const value = row[i];
    if (value === "" || value == null || Number.isNaN(Number(value))) return;
    out[`20${m[1]}-T${m[2]}`] = Number(value);
  });
  return out;
}

const data = {};
for (const [key, re] of Object.entries(SHEETS)) {
  const name = wb.SheetNames.find((n) => re.test(n.trim()));
  if (!name) throw new Error(`Falta la hoja de ${key}: ${wb.SheetNames.join(" · ")}`);
  data[key] = series(name);
}

// Las ocho provincias andaluzas, total y alquiler del último año completo, para comparar tasas.
const andalucia = {};
for (const prov of ANDALUCIA) {
  const total = series(wb.SheetNames.find((n) => SHEETS.total.test(n.trim())), prov);
  const lau = series(wb.SheetNames.find((n) => SHEETS.lau.test(n.trim())), prov);
  andalucia[prov] = { total, lau };
}

const quarters = Object.keys(data.total).sort();
const last = quarters.at(-1);
const byYear = {};
for (const q of quarters) {
  const y = q.slice(0, 4);
  byYear[y] ??= { quarters: 0, total: 0, lau: 0, hipotecaria: 0, otros: 0 };
  byYear[y].quarters += 1;
  for (const k of ["total", "lau", "hipotecaria", "otros"]) byYear[y][k] += data[k][q] ?? 0;
}
const lastFullYear = Object.keys(byYear).filter((y) => byYear[y].quarters === 4).sort().at(-1);
const last4 = quarters.slice(-4);
const sum = (k) => last4.reduce((s, q) => s + (data[k][q] ?? 0), 0);

await writeFile(
  new URL("../src/data/desahucios.json", import.meta.url),
  JSON.stringify(
    {
      source: "Consejo General del Poder Judicial, Estadística Judicial: efecto de la crisis en los órganos judiciales, series por provincias. Lanzamientos practicados",
      source_url: PAGE,
      file_url: fileUrl,
      province: "Cádiz",
      last_quarter: last,
      last_full_year: lastFullYear,
      last_year: byYear[lastFullYear],
      last_4_quarters: { from: last4[0], to: last, total: sum("total"), lau: sum("lau"), hipotecaria: sum("hipotecaria"), otros: sum("otros") },
      andalucia: Object.fromEntries(
        Object.entries(andalucia).map(([prov, s]) => {
          const yq = Object.keys(s.total).filter((k) => k.startsWith(lastFullYear));
          return [prov, { year: lastFullYear, total: yq.reduce((a, k) => a + (s.total[k] ?? 0), 0), lau: yq.reduce((a, k) => a + (s.lau[k] ?? 0), 0) }];
        }),
      ),
      by_year: byYear,
      quarters: data,
      generated_at: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ) + "\n",
);
console.log(`Hasta ${last}. ${lastFullYear}: ${byYear[lastFullYear].total} lanzamientos en la provincia (${byYear[lastFullYear].lau} de alquiler, ${byYear[lastFullYear].hipotecaria} hipotecarios). Últimos 4 trimestres: ${sum("total")}.`);
