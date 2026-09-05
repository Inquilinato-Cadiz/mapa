type Level = "alto" | "medio" | "info";
type Regime = "pre2013" | "r2013" | "r2019" | "r2023";
type Ctx = { regime: Regime; legal: boolean; years: number };
type Verdict = { level: Level; text: string; ref: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>("contrato");
const signed = $<HTMLInputElement>("signed");
const landlord = $<HTMLSelectElement>("landlord");
const regimeNote = $<HTMLParagraphElement>("regime");
const result = $<HTMLElement>("result");

const regimeFor = (date: string): Regime => {
  if (date >= "2023-05-26") return "r2023";
  if (date >= "2019-03-06") return "r2019";
  if (date >= "2013-06-06") return "r2013";
  return "pre2013";
};

const regimeLabel: Record<Regime, string> = {
  pre2013: "Contrato anterior a junio de 2013: LAU de 1994. Prórroga obligatoria de 5 años y tácita de 3.",
  r2013: "Contrato entre junio de 2013 y marzo de 2019: reforma de 2013. Prórroga obligatoria de 3 años y tácita de 1.",
  r2019: "Contrato entre marzo de 2019 y mayo de 2023: RDL 7/2019. Prórroga obligatoria de 5 años (7 si el arrendador es persona jurídica) y tácita de 3.",
  r2023: "Contrato desde el 26 de mayo de 2023: Ley 12/2023 por el derecho a la vivienda. Prórroga de 5 años (7 si el arrendador es persona jurídica), gastos de agencia a cargo del arrendador y tope IRAV en las actualizaciones.",
};

// Cada cláusula devuelve un veredicto según régimen y arrendador.
const rules: Record<string, (c: Ctx) => Verdict> = {
  duration: (c) => ({
    level: "info",
    text: `No es ilegal, pero da igual lo que ponga: tienes derecho a prorrogar hasta ${c.years} años${c.regime !== "r2013" && c.legal ? " porque el arrendador es persona jurídica" : ""}. Calcula tus fechas en la herramienta de plazos.`,
    ref: "LAU art. 9",
  }),
  waiver: () => ({
    level: "alto",
    text: "Nula. No se puede renunciar a la prórroga obligatoria por adelantado; sólo el arrendador puede recuperar el piso por necesidad propia, a partir del primer año, con dos meses de aviso y si constaba en el contrato.",
    ref: "LAU arts. 6 y 9.3",
  }),
  deposit: (c) => ({
    level: "alto",
    text: c.regime === "pre2013" || c.regime === "r2013"
      ? "La fianza legal de vivienda es una mensualidad. Con tu fecha de contrato la ley no limitaba las garantías adicionales, pero tenían que estar pactadas como tales, no llamarse fianza."
      : "La fianza legal es una mensualidad. Las garantías adicionales (aval, depósito) no pueden superar dos mensualidades más en contratos de hasta 5 o 7 años.",
    ref: "LAU art. 36",
  }),
  agency: (c) => {
    if (c.regime === "r2023") return { level: "alto", text: "Desde el 26 de mayo de 2023 los gastos de gestión inmobiliaria y de formalización son siempre del arrendador, sea particular o empresa. Puedes reclamarlos aunque los hayas pagado.", ref: "LAU art. 20.1, Ley 12/2023" };
    if (c.regime === "r2019" && c.legal) return { level: "alto", text: "Como el arrendador es persona jurídica, desde marzo de 2019 los gastos de gestión inmobiliaria y de formalización le corresponden a él. Puedes reclamarlos.", ref: "LAU art. 20.1, RDL 7/2019" };
    return { level: "info", text: "Con tu fecha de contrato y un arrendador particular la ley permitía cobrártelos. No es reclamable, pero sí un argumento en la renovación: hoy ya no se puede.", ref: "LAU art. 20.1" };
  },
  update: (c) => ({
    level: "medio",
    text: c.regime === "r2023"
      ? "La actualización tiene que estar pactada y referida a un índice, y nunca puede superar el IRAV del INE del mes en que toca. Sin cláusula, no hay actualización."
      : c.regime === "r2019"
        ? "La actualización tiene que estar pactada y no puede superar la variación del IPC. Sin cláusula, no hay actualización."
        : "La actualización tiene que estar pactada y referida a un índice objetivo. Sin cláusula, no hay actualización. Recuerda los topes de 2023 (2 %) y 2024 (3 %), que se aplicaron a todos los contratos.",
    ref: "LAU art. 18",
  }),
  seasonal: () => ({
    level: "alto",
    text: "Si vives ahí de forma permanente, el contrato es de vivienda aunque lo llamen de temporada, y se aplican las prórrogas y límites de la LAU. Es un fraude muy extendido en Cádiz.",
    ref: "LAU arts. 2 y 3; jurisprudencia",
  }),
  census: () => ({
    level: "alto",
    text: "No pueden impedirlo. Empadronarte donde vives es tu obligación legal y tu derecho, y no necesitas permiso del propietario.",
    ref: "Ley 7/1985 de Bases del Régimen Local, art. 15",
  }),
  penalty: (c) => ({
    level: c.regime === "pre2013" ? "info" : "medio",
    text: c.regime === "pre2013"
      ? "En contratos anteriores a junio de 2013 el desistimiento anticipado se regía por lo pactado; la ley no fijaba tope. Tráelo a la asamblea para mirar la cláusula concreta."
      : "Puedes desistir a partir del sexto mes avisando con 30 días. La indemnización máxima es una mensualidad por cada año que quede, proporcional a los meses. Y sólo si el contrato la recoge.",
    ref: "LAU art. 11",
  }),
  repairs: () => ({
    level: "medio",
    text: "Las reparaciones necesarias para conservar la vivienda habitable son del arrendador. A ti te corresponden sólo las pequeñas reparaciones por el desgaste del uso ordinario.",
    ref: "LAU art. 21",
  }),
  expenses: () => ({
    level: "medio",
    text: "Sólo pueden repercutirte gastos generales si están pactados por escrito y con su importe anual a la fecha del contrato. Sin importe, no procede.",
    ref: "LAU art. 20.1",
  }),
  entry: () => ({
    level: "alto",
    text: "Es tu domicilio y es inviolable. Sólo puede entrar con tu consentimiento; puedes pactar visitas con antelación razonable, pero nunca sin permiso.",
    ref: "Constitución art. 18.2",
  }),
  sale: (c) => ({
    level: "medio",
    text: `La venta no acaba con tu contrato durante la prórroga obligatoria (${c.years} años en tu caso). El nuevo propietario se convierte en tu arrendador con las mismas condiciones.`,
    ref: "LAU art. 14",
  }),
};

const badge: Record<Level, string> = { alto: "bg-red-100 text-red-800", medio: "bg-amber-100 text-amber-800", info: "bg-neutral-200 text-neutral-700" };
const label: Record<Level, string> = { alto: "Nulo o ilegal", medio: "Abusivo o limitado por ley", info: "Legal, pero con derechos" };
const order: Level[] = ["alto", "medio", "info"];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const context = (): Ctx | null => {
  if (!signed.value) return null;
  const regime = regimeFor(signed.value);
  const legal = landlord.value === "legal";
  const years = regime === "r2013" ? 3 : legal && regime !== "pre2013" ? 7 : 5;
  return { regime, legal, years };
};

const refreshRegime = () => {
  const c = context();
  regimeNote.textContent = c ? regimeLabel[c.regime] : "Indica la fecha de firma: cambia lo que la ley permite.";
};

form.addEventListener("submit", () => {
  const c = context();
  if (!c) { signed.focus(); regimeNote.textContent = "Falta la fecha de firma."; return; }
  const questions = new Map([...form.querySelectorAll<HTMLInputElement>("input[name=check]")].map((i) => [i.value, i.parentElement?.textContent?.trim() ?? i.value]));
  const selected = [...form.querySelectorAll<HTMLInputElement>("input[name=check]:checked")].map((i) => i.value);
  const hits = selected.map((id) => ({ id, q: questions.get(id) ?? id, ...rules[id](c) })).sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));

  if (hits.length === 0) {
    result.innerHTML = `<div class="rounded-lg border-2 border-brand bg-white p-5"><h2 class="display text-2xl">Nada de la lista</h2><p class="mt-2">No has marcado ninguna de las cláusulas habituales. Si algo del contrato te chirría igualmente, tráelo a la asamblea.</p></div>`;
  } else {
    const serious = hits.filter((h) => h.level === "alto").length;
    result.innerHTML = `<div class="rounded-lg border-2 border-brand bg-white p-5">
      <h2 class="display text-2xl">${serious > 0 ? `${serious} cláusula${serious > 1 ? "s" : ""} nula${serious > 1 ? "s" : ""} o ilegal${serious > 1 ? "es" : ""}` : "Cláusulas a vigilar"}</h2>
      <p class="mt-1 text-sm text-neutral-600">${esc(regimeLabel[c.regime])} Que una cláusula sea nula no significa que el contrato lo sea: el resto sigue valiendo y tú sigues en tu casa.</p>
      <ol class="mt-4 space-y-4">${hits.map((h) => `<li>
        <span class="rounded px-2 py-0.5 text-xs font-medium ${badge[h.level]}">${label[h.level]}</span>
        <p class="mt-1 font-medium">${esc(h.q)}</p>
        <p class="mt-1 text-sm text-neutral-700">${esc(h.text)}</p>
        <p class="mt-1 text-xs text-neutral-500">${esc(h.ref)}</p>
      </li>`).join("")}</ol>
    </div>`;
  }
  result.classList.remove("hidden");
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});

[signed, landlord].forEach((el) => el.addEventListener("input", refreshRegime));
refreshRegime();

export {};
