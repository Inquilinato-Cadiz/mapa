import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

type Props = {
  id: string;
  type: "VUT" | "AT";
  group: string | null;
  address: string;
  postal_code: string | null;
  places: number | null;
  units: number | null;
  registered: string | null;
  catastro: string | null;
  holder: string | null;
  holder_count: number | null;
};
type Feature = GeoJSON.Feature<GeoJSON.Point, Props>;

// El plugin de clústeres se cuelga del L global, así que va después de Leaflet.
(window as unknown as { L: typeof L }).L = L;
await import("leaflet.markercluster");

const map = L.map("map", { center: [36.528, -6.285], zoom: 14, minZoom: 12, maxZoom: 19 });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const cluster = L.markerClusterGroup({ disableClusteringAtZoom: 18, maxClusterRadius: 50, showCoverageOnHover: false });
map.addLayer(cluster);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const q = $<HTMLInputElement>("q");
const group = $<HTMLSelectElement>("group");
const cp = $<HTMLSelectElement>("cp");
const companies = $<HTMLInputElement>("companies");
const count = $<HTMLParagraphElement>("count");
const results = $<HTMLUListElement>("results");

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const popup = (p: Props) => {
  const holder = p.holder
    ? `<strong>${esc(p.holder)}</strong>${p.holder_count && p.holder_count > 1 ? ` <span class="text-neutral-500">(${p.holder_count} alojamientos en Cádiz)</span>` : ""}`
    : `<span class="text-neutral-600">Particular</span>`;
  const rows = [
    ["Tipo", `${p.type === "VUT" ? "Vivienda de uso turístico" : "Apartamento turístico"}${p.group ? ` · ${esc(p.group)}` : ""}`],
    ["Plazas", p.places != null ? String(p.places) : "—"],
    ["Titular", holder],
    ["Registro", `${esc(p.id)}${p.registered ? ` · desde ${p.registered.slice(0, 4)}` : ""}`],
  ];
  const catastro = p.catastro
    ? `<a class="underline" target="_blank" rel="noopener" href="https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${encodeURIComponent(p.catastro)}">Ver en Catastro</a>`
    : "";
  return `<p class="font-semibold">${esc(p.address)}${p.postal_code ? ` <span class="font-normal text-neutral-500">${esc(p.postal_code)}</span>` : ""}</p>
    <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">${rows.map(([k, v]) => `<dt class="text-neutral-500">${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <p class="mt-2 text-xs">${catastro} <a class="ml-2 underline" href="/denuncia/">¿Algo no cuadra?</a></p>`;
};

const color = (p: Props) => (p.group === "Por habitaciones" ? "#7c3aed" : p.holder ? "#c9451c" : "#f05a28");

let all: Feature[] = [];
const markers = new Map<Feature, L.CircleMarker>();

const render = () => {
  const term = normalize(q.value.trim());
  const visible = all.filter((f) => {
    const p = f.properties;
    if (group.value && p.group !== group.value) return false;
    if (cp.value && p.postal_code !== cp.value) return false;
    if (companies.checked && !p.holder) return false;
    if (term && !normalize(p.address).includes(term)) return false;
    return true;
  });

  cluster.clearLayers();
  cluster.addLayers(visible.map((f) => markers.get(f)!));

  const places = visible.reduce((s, f) => s + (f.properties.places ?? 0), 0);
  count.textContent = `${visible.length.toLocaleString("es-ES")} alojamientos · ${places.toLocaleString("es-ES")} plazas`;

  if (term && visible.length > 0 && visible.length <= 40) {
    results.innerHTML = visible
      .map((f) => `<li><button type="button" class="block w-full px-3 py-2 text-left hover:bg-neutral-50" data-id="${esc(f.properties.id)}">${esc(f.properties.address)} <span class="text-xs text-neutral-500">${f.properties.holder ? esc(f.properties.holder) : "particular"}</span></button></li>`)
      .join("");
    results.classList.remove("hidden");
    if (visible.length <= 12) map.fitBounds(L.featureGroup(visible.map((f) => markers.get(f)!)).getBounds(), { padding: [40, 40], maxZoom: 18 });
  } else {
    results.innerHTML = "";
    results.classList.add("hidden");
  }
};

results.addEventListener("click", (e) => {
  const id = (e.target as HTMLElement).closest("button")?.dataset.id;
  const f = all.find((x) => x.properties.id === id);
  if (!f) return;
  const m = markers.get(f)!;
  map.setView(m.getLatLng(), 18);
  cluster.zoomToShowLayer(m, () => m.openPopup());
});

const data = (await (await fetch("/data/vut-cadiz.geojson")).json()) as GeoJSON.FeatureCollection<GeoJSON.Point, Props>;
all = data.features;
for (const f of all) {
  const [lng, lat] = f.geometry.coordinates;
  const m = L.circleMarker([lat, lng], { radius: 6, color: "#fff", weight: 1, fillColor: color(f.properties), fillOpacity: 0.9 });
  m.bindPopup(popup(f.properties), { maxWidth: 320 });
  markers.set(f, m);
}

// Enlaces desde otras páginas: /?cp=11002 o /?q=sopranis
const params = new URLSearchParams(location.search);
if (params.get("cp") && [...cp.options].some((o) => o.value === params.get("cp"))) cp.value = params.get("cp")!;
if (params.get("q")) q.value = params.get("q")!;

[q, group, cp, companies].forEach((el) => el.addEventListener("input", render));
render();
