type Indices = { ipc: { values: Record<string, number>; url: string }; irav: { values: Record<string, number>; url: string } };
const indices = (window as unknown as { __indices: Indices }).__indices;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>("renta");
const rent = $<HTMLInputElement>("rent");
const signed = $<HTMLInputElement>("signed");
const update = $<HTMLInputElement>("update");
const clause = $<HTMLSelectElement>("clause");
const index = $<HTMLInputElement>("index");
const help = $<HTMLSpanElement>("index-help");
const result = $<HTMLElement>("result");

const NEW_LAW = "2023-05-26";
const euro = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const pct = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;

type Regime = { kind: "irav" | "ipc"; cap: number | null; label: string };

const regime = (): Regime | null => {
  if (!signed.value || !update.value) return null;
  const year = Number(update.value.slice(0, 4));
  if (year === 2023) return { kind: "ipc", cap: 2, label: "límite extraordinario del 2 % para 2023" };
  if (year === 2024) return { kind: "ipc", cap: 3, label: "límite extraordinario del 3 % para 2024" };
  if (signed.value >= NEW_LAW) return { kind: "irav", cap: null, label: "IRAV del INE del mes de actualización (contrato posterior al 26/05/2023)" };
  return { kind: "ipc", cap: null, label: "índice pactado en el contrato, normalmente el IPC (contrato anterior al 26/05/2023)" };
};

const refreshHelp = () => {
  const r = regime();
  if (!r) { help.textContent = "Rellena las fechas para saber qué índice toca."; return; }
  const known = r.kind === "irav" ? indices.irav.values[update.value] : indices.ipc.values[update.value];
  if (known != null && !index.value) index.value = String(known);
  const source = r.kind === "irav"
    ? `Busca el IRAV de ${update.value} en el <a class="underline" target="_blank" rel="noopener" href="${indices.irav.url}">INE</a>.`
    : `Busca la variación anual del IPC de ${update.value} en el <a class="underline" target="_blank" rel="noopener" href="${indices.ipc.url}">INE</a>.`;
  help.innerHTML = `Toca aplicar el ${r.label}. ${known != null ? `Tenemos guardado ${pct(known)}.` : source}`;
};

const render = () => {
  const r = regime();
  const current = Number(rent.value);
  if (!r || !current) return;
  const value = Number(index.value.replace(",", "."));
  let html = "";

  if (clause.value === "none") {
    html = `<h2 class="display text-2xl">Sin cláusula, sin subida</h2>
      <p class="mt-2">Si tu contrato no dice nada de actualizar la renta, la renta no se actualiza. Sigues pagando <strong>${euro(current)}</strong> (LAU, art. 18.1).</p>`;
  } else {
    if (!index.value) { result.innerHTML = `<p>Falta el valor del índice para calcular.</p>`; result.classList.remove("hidden"); return; }
    const applied = r.cap != null ? Math.min(value, r.cap) : value;
    const capped = r.cap != null && value > r.cap;
    const newRent = Math.round(current * (1 + applied / 100) * 100) / 100;
    html = `<h2 class="display text-2xl">Subida máxima: ${pct(Math.max(applied, 0))}</h2>
      <p class="mt-2 text-lg">De <strong>${euro(current)}</strong> a <strong>${euro(newRent)}</strong> al mes (${euro(newRent - current)} más).</p>
      <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
        <li>Se aplica el ${r.label}${capped ? `: el índice era ${pct(value)}, pero el tope legal es ${pct(r.cap!)}` : ""}.</li>
        ${clause.value === "unknown" ? "<li>Si al final tu contrato no tiene cláusula de actualización, la subida es cero. Busca la palabra «actualización» o «IPC» en el contrato.</li>" : ""}
        ${applied < 0 ? "<li>El índice es negativo: si el contrato dice que se actualiza «según el IPC», la renta baja.</li>" : ""}
        <li>Sólo puede subirla una vez al año, en la fecha del contrato, avisándote por escrito. Se aplica desde el mes siguiente al aviso, sin atrasos.</li>
      </ul>
      <h3 class="mt-4 font-medium">Qué contestar si te piden más</h3>
      <pre class="mt-2 whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-sm">Hola. He revisado la actualización de renta que me comunicas. Según el artículo 18 de la LAU y la Ley 12/2023, la actualización anual de mi contrato (firmado el ${signed.value.split("-").reverse().join("/")}) no puede superar el ${pct(Math.max(applied, 0))}, que corresponde a ${r.label.split(" (")[0]}. La renta actualizada queda en ${euro(newRent)} mensuales. Cualquier cantidad por encima no procede y no la abonaré. Un saludo.</pre>`;
  }
  result.innerHTML = html;
  result.classList.remove("hidden");
};

[signed, update].forEach((el) => el.addEventListener("input", refreshHelp));
form.addEventListener("submit", render);
refreshHelp();

// Módulo ES: evita que TypeScript comparta el ámbito global entre scripts.
export {};
