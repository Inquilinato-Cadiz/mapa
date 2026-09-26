// Aparición al hacer scroll y contadores de cifras. Sin dependencias.
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

const countUp = (el: HTMLElement) => {
  const target = Number(el.dataset.count);
  if (reduced || !Number.isFinite(target)) {
    el.textContent = fmt(target);
    return;
  }
  const start = performance.now();
  const duration = 1200;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      el.classList.add("is-in");
      el.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
      if (el.dataset.count) countUp(el);
      observer.unobserve(el);
    }
  },
  { rootMargin: "0px 0px -10% 0px" },
);

document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => observer.observe(el));

export {};
