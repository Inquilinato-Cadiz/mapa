#!/usr/bin/env node
// Guarda una foto mensual de las viviendas turísticas para poder ver la
// evolución: añade a src/data/historico.json la fecha de los datos de OpenRTA
// (source_updated_at) con el total y las plazas de la provincia y el total de
// cada municipio. Si esa fecha ya está, no hace nada. Se ejecuta en el
// workflow mensual después de `npm run data`.
// Uso: node scripts/build-historico.mjs
import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../src/data/historico.json", import.meta.url);
const stats = JSON.parse(await readFile(new URL("../src/data/stats.json", import.meta.url), "utf8"));
let historico;
try {
  historico = JSON.parse(await readFile(file, "utf8"));
} catch {
  historico = { source: "OpenRTA, Registro de Turismo de Andalucía: una foto por descarga mensual", snapshots: [] };
}

const date = stats.source_updated_at;
if (historico.snapshots.some((s) => s.date === date)) {
  console.log(`Ya hay foto del ${date}: ${historico.snapshots.length} fotos.`);
  process.exit(0);
}
const municipios = Object.fromEntries(stats.province.by_municipio.map((m) => [m.slug, m.total]));
historico.snapshots.push({ date, total: stats.province.total, places: stats.province.places, municipios });
historico.snapshots.sort((a, b) => a.date.localeCompare(b.date));
await writeFile(file, JSON.stringify(historico, null, 2) + "\n");
console.log(`Foto del ${date} añadida: ${historico.snapshots.length} fotos.`);
