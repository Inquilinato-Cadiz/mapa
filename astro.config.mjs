// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://mapa.inquilinatocadiz.org",
  // La sección se llamó "herramientas" en la primera versión.
  redirects: {
    "/herramientas/": "/utilidades/",
    "/herramientas/renta/": "/utilidades/renta/",
    "/herramientas/plazos/": "/utilidades/plazos/",
    "/herramientas/contrato/": "/utilidades/contrato/",
    "/herramientas/precio-referencia/": "/utilidades/precio-referencia/",
  },
  vite: { plugins: [tailwindcss()] },
});
