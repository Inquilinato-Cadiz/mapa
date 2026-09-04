const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>("plazos");
const start = $<HTMLInputElement>("start");
const months = $<HTMLInputElement>("months");
const landlord = $<HTMLSelectElement>("landlord");
const result = $<HTMLElement>("result");

const addMonths = (d: Date, n: number) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const fmt = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
const today = new Date();

type Regime = { name: string; mandatoryYears: number; tacitYears: number; landlordNotice: string; tenantNotice: string; landlordNoticeDays: number; tenantNoticeDays: number };

const regimeFor = (d: Date, legal: boolean): Regime => {
  if (d >= new Date("2019-03-06")) {
    return { name: "LAU tras el RDL 7/2019", mandatoryYears: legal ? 7 : 5, tacitYears: 3, landlordNotice: "4 meses", tenantNotice: "2 meses", landlordNoticeDays: -1, tenantNoticeDays: -1 };
  }
  if (d >= new Date("2013-06-06")) {
    return { name: "LAU tras la reforma de 2013", mandatoryYears: 3, tacitYears: 1, landlordNotice: "30 días", tenantNotice: "30 días", landlordNoticeDays: 30, tenantNoticeDays: 30 };
  }
  return { name: "LAU de 1994", mandatoryYears: 5, tacitYears: 3, landlordNotice: "30 días", tenantNotice: "30 días", landlordNoticeDays: 30, tenantNoticeDays: 30 };
};

const render = () => {
  if (!start.value) return;
  const s = new Date(start.value);
  const agreed = Math.max(1, Number(months.value) || 12);
  const legal = landlord.value === "legal";
  const r = regimeFor(s, legal);

  const agreedEnd = addMonths(s, agreed);
  const mandatoryEnd = addMonths(s, r.mandatoryYears * 12);
  const inMandatory = agreedEnd < mandatoryEnd;
  const tacitEnd = addMonths(mandatoryEnd, r.tacitYears * 12);
  const landlordNoticeBy = r.landlordNoticeDays > 0 ? addDays(mandatoryEnd, -r.landlordNoticeDays) : addMonths(mandatoryEnd, -4);
  const tenantNoticeBy = r.tenantNoticeDays > 0 ? addDays(mandatoryEnd, -r.tenantNoticeDays) : addMonths(mandatoryEnd, -2);
  const withdrawalFrom = addMonths(s, 6);

  const renewals: Date[] = [];
  for (let d = agreedEnd; d < mandatoryEnd; d = addMonths(d, agreed)) renewals.push(d);

  const status = today < mandatoryEnd
    ? `<p class="mt-2 text-lg">Hoy estás dentro de la <strong>prórroga obligatoria</strong>: puedes quedarte hasta el <strong>${fmt(mandatoryEnd)}</strong> aunque el contrato ponga ${agreed} meses.</p>`
    : today < tacitEnd
      ? `<p class="mt-2 text-lg">La prórroga obligatoria terminó el ${fmt(mandatoryEnd)}. Estás en <strong>prórroga tácita</strong>, que se renueva año a año hasta el <strong>${fmt(tacitEnd)}</strong> salvo aviso.</p>`
      : `<p class="mt-2 text-lg">Las prórrogas legales de este contrato terminaron el ${fmt(tacitEnd)}. Si sigues en el piso, habla con el sindicato: la situación depende de lo que haya pasado desde entonces.</p>`;

  result.innerHTML = `<h2 class="display text-2xl">Tus fechas</h2>${status}
    <dl class="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt class="text-neutral-500">Régimen aplicable</dt><dd>${r.name}. Prórroga obligatoria de ${r.mandatoryYears} años${legal ? " (arrendador persona jurídica)" : ""} y tácita de ${r.tacitYears}.</dd>
      <dt class="text-neutral-500">Fin del plazo del contrato</dt><dd>${fmt(agreedEnd)}${inMandatory ? " — se prorroga solo si no avisas tú" : ""}</dd>
      ${renewals.length > 1 ? `<dt class="text-neutral-500">Renovaciones anuales</dt><dd>${renewals.map(fmt).join(" · ")}</dd>` : ""}
      <dt class="text-neutral-500">Fin de la prórroga obligatoria</dt><dd><strong>${fmt(mandatoryEnd)}</strong></dd>
      <dt class="text-neutral-500">El arrendador debe avisarte antes del</dt><dd>${fmt(landlordNoticeBy)} (${r.landlordNotice} antes) si no quiere prorrogar. Si no avisa, sigues.</dd>
      <dt class="text-neutral-500">Tú debes avisar antes del</dt><dd>${fmt(tenantNoticeBy)} (${r.tenantNotice} antes) si quieres irte al acabar la prórroga obligatoria.</dd>
      <dt class="text-neutral-500">Fin de la prórroga tácita</dt><dd>${fmt(tacitEnd)}</dd>
      <dt class="text-neutral-500">Puedes irte cuando quieras desde</dt><dd>${fmt(withdrawalFrom)}, avisando con 30 días.</dd>
    </dl>
    <p class="mt-4 text-sm text-neutral-700">Durante la prórroga obligatoria sólo pueden recuperar el piso por necesidad propia o de familiares de primer grado, avisando con 2 meses y si el contrato lo recogía al firmarlo (art. 9.3). Y sólo a partir del primer año.</p>`;
  result.classList.remove("hidden");
};

form.addEventListener("submit", render);
