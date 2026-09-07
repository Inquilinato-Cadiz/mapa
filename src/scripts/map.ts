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
type MunicipioFile = GeoJSON.FeatureCollection<GeoJSON.Point, Props> & {
  municipio: { slug: string; name: string; total: number; places: number; source_updated_at: string | null };
};

// El plugin de clústeres se cuelga del L global, así que va después de Leaflet.
(window as unknown as { L: typeof L }).L = L;
await import("leaflet.markercluster");

const map = L.map("map", { center: [36.528, -6.285], zoom: 14, minZoom: 9, maxZoom: 19 });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const cluster = L.markerClusterGroup({ disableClusteringAtZoom: 18, maxClusterRadius: 50, showCoverageOnHover: false });
map.addLayer(cluster);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const muni = $<HTMLSelectElement>("muni");
const q = $<HTMLInputElement>("q");
const group = $<HTMLSelectElement>("group");
const cp = $<HTMLSelectElement>("cp");
const companies = $<HTMLInputElement>("companies");
const count = $<HTMLParagraphElement>("count");
const results = $<HTMLUListElement>("results");
const muniName = $<HTMLElement>("muni-name");
const muniStats = $<HTMLElement>("muni-stats");

const fmt = (n: number) => n.toLocaleString("es-ES");
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

let current = { slug: "", name: "" };

const popup = (p: Props) => {
  const holder = p.holder
    ? `<strong>${esc(p.holder)}</strong>${p.holder_count && p.holder_count > 1 ? ` <span class="text-neutral-500">(${p.holder_count} alojamientos en ${esc(current.name)})</span>` : ""}`
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
  count.textContent = `${fmt(visible.length)} alojamientos · ${fmt(places)} plazas`;

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

// Los códigos postales dependen del municipio: se rellenan con los datos cargados.
const fillPostalCodes = (wanted: string) => {
  const counts = new Map<string, number>();
  for (const f of all) {
    const c = f.properties.postal_code;
    if (c && /^11\d{3}$/.test(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  cp.innerHTML = `<option value="">Todos</option>` + [...counts.entries()].sort().map(([c, n]) => `<option value="${c}">${c} (${n})</option>`).join("");
  cp.value = counts.has(wanted) ? wanted : "";
};

const load = async (slug: string, wantedCp = "") => {
  count.textContent = "Cargando…";
  const data = (await (await fetch(`/data/municipios/${slug}.geojson`)).json()) as MunicipioFile;
  current = { slug, name: data.municipio.name };
  all = data.features;
  markers.clear();
  for (const f of all) {
    const [lng, lat] = f.geometry.coordinates;
    const marker = L.circleMarker([lat, lng], { radius: 6, color: "#fff", weight: 1, fillColor: color(f.properties), fillOpacity: 0.9 });
    marker.bindPopup(popup(f.properties), { maxWidth: 320 });
    markers.set(f, marker);
  }
  muniName.textContent = data.municipio.name;
  muniStats.textContent = `${fmt(data.municipio.total)} alojamientos turísticos registrados y ${fmt(data.municipio.places)} plazas`;
  fillPostalCodes(wantedCp);
  if (all.length) map.fitBounds(L.featureGroup([...markers.values()]).getBounds(), { padding: [20, 20], maxZoom: 15 });
  render();
};

results.addEventListener("click", (e) => {
  const id = (e.target as HTMLElement).closest("button")?.dataset.id;
  const f = all.find((x) => x.properties.id === id);
  if (!f) return;
  const marker = markers.get(f)!;
  map.setView(marker.getLatLng(), 18);
  cluster.zoomToShowLayer(marker, () => marker.openPopup());
});

// Enlaces desde otras páginas: /?m=tarifa, /?m=cadiz&cp=11002 o /?q=sopranis
const params = new URLSearchParams(location.search);
const requested = params.get("m");
const initial = requested && [...muni.options].some((o) => o.value === requested) ? requested : "cadiz";
muni.value = initial;
if (params.get("q")) q.value = params.get("q")!;

muni.addEventListener("change", () => {
  const url = new URL(location.href);
  url.searchParams.set("m", muni.value);
  url.searchParams.delete("cp");
  history.replaceState(null, "", url);
  q.value = "";
  void load(muni.value);
});
[q, group, cp, companies].forEach((el) => el.addEventListener("input", render));
await load(initial, params.get("cp") ?? "");

// Módulo ES: evita que TypeScript comparta el ámbito global entre scripts.
export {};
