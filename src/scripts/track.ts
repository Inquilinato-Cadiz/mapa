// Eventos de uso para Umami. Sin datos personales: nunca se envía lo que
// escribe la persona (calles, rentas, fechas), sólo qué herramienta se usa y
// con qué opción. Si Umami no carga (bloqueador, sin red), no pasa nada.
type Data = Record<string, string | number | boolean>;
declare global {
  interface Window {
    umami?: { track: (name: string, data?: Data) => void };
  }
}

export const track = (name: string, data?: Data) => {
  try {
    window.umami?.track(name, data);
  } catch {
    /* sin estadísticas */
  }
};

// Para acciones repetitivas (escribir en un buscador): una sola vez por página.
const once = new Set<string>();
export const trackOnce = (name: string, data?: Data) => {
  if (once.has(name)) return;
  once.add(name);
  track(name, data);
};
