import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  ref: string;
  address: string;
  postal_code: string | null;
  homes: number;
  area: number | null;
  year: number | null;
};
type Feature = GeoJSON.Feature<GeoJSON.Point, Props>;

const map = L.map("map", { center: [36.528, -6.285], zoom: 14, minZoom: 12, maxZoom: 19 });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const layer = L.layerGroup().addTo(map);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const q = $<HTMLInputElement>("q");
const min = $<HTMLSelectElement>("min");
const cp = $<HTMLSelectElement>("cp");
const count = $<HTMLParagraphElement>("count");
const results = $<HTMLUListElement>("results");

const fmt = (n: number) => n.toLocaleString("es-ES");
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const popup = (p: Props) => {
  const rows = [
    ["Viviendas", `<strong>${fmt(p.homes)}</strong>`],
    ["Superficie", p.area ? `${fmt(p.area)} m² construidos` : "—"],
    ["Construida", p.year ? String(p.year) : "—"],
    ["Catastro", `<a class="underline" target="_blank" rel="noopener" href="https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${encodeURIComponent(p.ref)}">${esc(p.ref)}</a>`],
  ];
  return `<p class="font-semibold">${esc(p.address)}${p.postal_code ? ` <span class="font-normal text-neutral-500">${esc(p.postal_code)}</span>` : ""}</p>
    <p class="mt-1 text-xs text-neutral-600">Finca entera de un único propietario.</p>
    <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">${rows.map(([k, v]) => `<dt class="text-neutral-500">${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <p class="mt-3"><a class="inline-block rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark" href="https://inquilinatocadiz.org/participa/">¿Vives aquí? Organízate con el sindicato</a></p>`;
};

// El tamaño del círculo crece con la raíz del número de viviendas: 5 → 6 px, 50 → 12 px, 380 → 25 px.
const radius = (homes: number) => Math.min(28, 4 + Math.sqrt(homes) * 1.1);

let all: Feature[] = [];
const markers = new Map<Feature, L.CircleMarker>();

const render = () => {
  const term = normalize(q.value.trim());
  const minHomes = Number(min.value) || 0;
  const visible = all.filter((f) => {
    const p = f.properties;
    if (p.homes < minHomes) return false;
    if (cp.value && p.postal_code !== cp.value) return false;
    if (term && !normalize(p.address).includes(term)) return false;
    return true;
  });

  // Las fincas grandes van debajo para que las pequeñas sigan siendo clicables.
  layer.clearLayers();
  for (const f of visible) layer.addLayer(markers.get(f)!);

  const homes = visible.reduce((s, f) => s + f.properties.homes, 0);
  count.textContent = `${fmt(visible.length)} fincas · ${fmt(homes)} viviendas`;

  if (term && visible.length > 0 && visible.length <= 40) {
    results.innerHTML = visible
      .map((f) => `<li><button type="button" class="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50" data-ref="${esc(f.properties.ref)}"><span>${esc(f.properties.address)}</span> <span class="shrink-0 text-xs text-neutral-500">${fmt(f.properties.homes)} viv.</span></button></li>`)
      .join("");
    results.classList.remove("hidden");
    if (visible.length <= 12) map.fitBounds(L.featureGroup(visible.map((f) => markers.get(f)!)).getBounds(), { padding: [40, 40], maxZoom: 18 });
  } else {
    results.innerHTML = "";
    results.classList.add("hidden");
  }
};

results.addEventListener("click", (e) => {
  const ref = (e.target as HTMLElement).closest("button")?.dataset.ref;
  const f = all.find((x) => x.properties.ref === ref);
  if (!f) return;
  const marker = markers.get(f)!;
  map.setView(marker.getLatLng(), 18);
  marker.openPopup();
});

const data = (await (await fetch("/data/fincas-cadiz.geojson")).json()) as GeoJSON.FeatureCollection<GeoJSON.Point, Props>;
// El GeoJSON viene ordenado de más a menos viviendas; así se pintan primero las grandes.
all = data.features;
for (const f of all) {
  const [lng, lat] = f.geometry.coordinates;
  const marker = L.circleMarker([lat, lng], { radius: radius(f.properties.homes), color: "#c9451c", weight: 1.5, fillColor: "#f05a28", fillOpacity: 0.55 });
  marker.bindPopup(popup(f.properties), { maxWidth: 320 });
  marker.bindTooltip(`${esc(f.properties.address)} · ${fmt(f.properties.homes)} viviendas`, { direction: "top", offset: [0, -radius(f.properties.homes)] });
  markers.set(f, marker);
}

// Enlaces desde otras páginas: /fincas/?cp=11002, /fincas/?min=50 o /fincas/?q=barbate
const params = new URLSearchParams(location.search);
if (params.get("cp") && [...cp.options].some((o) => o.value === params.get("cp"))) cp.value = params.get("cp")!;
if (params.get("min") && [...min.options].some((o) => o.value === params.get("min"))) min.value = params.get("min")!;
if (params.get("q")) q.value = params.get("q")!;

[q, min, cp].forEach((el) => el.addEventListener("input", render));
render();

// Módulo ES: evita que TypeScript comparta el ámbito global entre scripts.
export {};
