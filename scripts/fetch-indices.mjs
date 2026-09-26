#!/usr/bin/env node
// Descarga del INE (API Tempus3) los dos índices que usa la calculadora de
// actualización de renta y escribe src/data/indices.json:
//   IPC  variación anual del índice general (serie IPC290750, base 2025)
//   IRAV Índice de Referencia de Arrendamientos de Vivienda (serie IRAV1)
// La calculadora siempre permite escribir el valor a mano; esto sólo evita
// que el dato guardado se quede viejo.
// Uso: node scripts/fetch-indices.mjs
import { writeFile } from "node:fs/promises";

const API = "https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE";
const MONTHS = 36;
const SERIES = {
  ipc: {
    code: "IPC290750",
    note: "Variación anual del IPC general (INE, serie IPC290750, base 2025). Se rellena con scripts/fetch-indices.mjs.",
    url: "https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176802&menu=ultiDatos&idp=1254735976607",
  },
  irav: {
    code: "IRAV1",
    note: "Índice de Referencia para la Actualización Anual de Contratos de Arrendamiento de Vivienda (INE, serie IRAV1). Publicado mensualmente desde enero de 2025. Introduce el valor del mes en que toca actualizar.",
    url: "https://www.ine.es/jaxiT3/Tabla.htm?t=72975",
  },
};

async function fetchSeries(code) {
  const res = await fetch(`${API}/${code}?nult=${MONTHS}`);
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`);
  const { Data } = await res.json();
  if (!Array.isArray(Data) || Data.length === 0) throw new Error(`${code}: sin datos`);
  const values = {};
  for (const d of Data) values[`${d.Anyo}-${String(d.FK_Periodo).padStart(2, "0")}`] = d.Valor;
  return Object.fromEntries(Object.entries(values).sort());
}

const out = { updated_at: new Date().toISOString().slice(0, 10) };
for (const [key, { code, note, url }] of Object.entries(SERIES)) {
  const values = await fetchSeries(code);
  const last = Object.keys(values).at(-1);
  console.log(`${key}: ${Object.keys(values).length} meses, último ${last} = ${values[last]} %`);
  out[key] = { note, url, values };
}
await writeFile("src/data/indices.json", JSON.stringify(out, null, 2) + "\n");
