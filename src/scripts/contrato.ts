type Check = { id: string; level: "alto" | "medio" | "info"; q: string; a: string; ref: string };
const checks = (window as unknown as { __checks: Check[] }).__checks;

const form = document.getElementById("contrato") as HTMLFormElement;
const result = document.getElementById("result") as HTMLElement;

const badge: Record<Check["level"], string> = {
  alto: "bg-red-100 text-red-800",
  medio: "bg-amber-100 text-amber-800",
  info: "bg-neutral-200 text-neutral-700",
};
const label: Record<Check["level"], string> = { alto: "Nulo o ilegal", medio: "Abusivo o limitado por ley", info: "Legal, pero con derechos" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

form.addEventListener("submit", () => {
  const selected = [...form.querySelectorAll<HTMLInputElement>("input[name=check]:checked")].map((i) => i.value);
  const hits = checks.filter((c) => selected.includes(c.id));
  const order: Check["level"][] = ["alto", "medio", "info"];
  hits.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));

  if (hits.length === 0) {
    result.innerHTML = `<div class="rounded-lg border-2 border-brand bg-white p-5"><h2 class="display text-2xl">Nada de la lista</h2><p class="mt-2">No has marcado ninguna de las cláusulas habituales. Si algo del contrato te chirría igualmente, tráelo a la asamblea.</p></div>`;
  } else {
    const serious = hits.filter((h) => h.level === "alto").length;
    result.innerHTML = `<div class="rounded-lg border-2 border-brand bg-white p-5">
      <h2 class="display text-2xl">${serious > 0 ? `${serious} cláusula${serious > 1 ? "s" : ""} nula${serious > 1 ? "s" : ""} o ilegal${serious > 1 ? "es" : ""}` : "Cláusulas a vigilar"}</h2>
      <p class="mt-1 text-sm text-neutral-600">Que una cláusula sea nula no significa que el contrato lo sea: el resto sigue valiendo y tú sigues en tu casa.</p>
      <ol class="mt-4 space-y-4">${hits.map((h) => `<li>
        <span class="rounded px-2 py-0.5 text-xs font-medium ${badge[h.level]}">${label[h.level]}</span>
        <p class="mt-1 font-medium">${esc(h.q)}</p>
        <p class="mt-1 text-sm text-neutral-700">${esc(h.a)}</p>
        <p class="mt-1 text-xs text-neutral-500">${esc(h.ref)}</p>
      </li>`).join("")}</ol>
    </div>`;
  }
  result.classList.remove("hidden");
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Módulo ES: evita que TypeScript comparta el ámbito global entre scripts.
export {};
