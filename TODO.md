# TODO - Pokepedia

## En Progreso


## Pendientes

### Features (Sección C — revisión futura)
- [ ] **C1 — Inline type effectiveness calculator**: Sustituir/complementar el enlace a poketypes.app con un widget inline en la página de Pokémon que muestre las x0, x0.5, x1, x2, x4 sin salir del sitio. Revisar si vale la pena dado que poketypes.app es el destino canónico.
- [ ] **C2 — PWA offline cache**: Service Worker que cachee las páginas de Pokémon más visitadas para uso offline. Compatible con Cloudflare Workers.
- [ ] **C3 — Team Builder**: Página `/[lang]/equipo` para seleccionar hasta 6 Pokémon y ver la cobertura de tipos del equipo. Podría enlazar con poketypes.app para el análisis completo.
- [ ] **C4 — Comparador ampliado**: Extender `/[lang]/comparar/[p1]/[p2]` para comparar más de 2 Pokémon en paralelo (hasta 4).
- [ ] **C5 — Página de generaciones/regiones**: Vista visual por generación con mapa de región. Actualmente el selector de gen solo filtra la pokedex.
- [ ] **C6 — Datos de movimientos en Smogon**: Cruzar datos de movimientos de PokeAPI con uso competitivo de Smogon (usage stats CDN). Mostrar "movimientos más usados" en la ficha.
- [ ] **C7 — Integración profunda poketypes.app**: Evaluar si incrustar el análisis de tipos de poketypes.app directamente (iframe o API compartida). Pendiente de decisión con el owner.
- [ ] **C8 — Historial de búsqueda**: Guardar en localStorage el historial de Pokémon visitados. Mostrar en el modal de búsqueda global como sugerencias recientes.

## Completados

- [x] Configuración inicial de CLAUDE.md con arquitectura del proyecto
- [x] **Frontend Audit — Sección A (Bugs)**:
  - [x] A1: XSS en innerHTML de suggestions (index, habilidades, movimientos, Layout modal) — DOM construction + escHtml()
  - [x] A2: Doble h1 en página de Pokémon → segundo h1 cambiado a h2
  - [x] A3: Barras de stats en comparador — proporcionales por suma total
  - [x] A4: Placeholder "Weaknesses" en comparador → enlaces a poketypes.app por Pokémon
  - [x] A5: Memory leak listeners (keydown/click/scroll) — AbortController en index + Layout; guard en CompetitiveSets
  - [x] A6: Evolución — `!== null` → `!= null` para capturar undefined en relative_physical_stats
  - [x] A7: is_hidden ability — Object.entries con key 'H' en lugar de index > 0
  - [x] A8: Promise.all → Promise.allSettled en loadFavoritesView
  - [x] A9: Race condition en MovesTable — prefetchRequestId counter
- [x] **Frontend Audit — Sección B (Mejoras)**:
  - [x] B1: N client fetches de tipos eliminados — getSmogonDataBatch SSR en index
  - [x] B2: data-moves attr → script type="application/json" en MovesTable
  - [x] B3: CompetitiveSets — showdownData SSR prop, skip client pokedex.json download
  - [x] B4: SEO titles/descriptions i18n en página de Pokémon
  - [x] B5: Labels hardcodeados ES → t.key en MovesTable, comparar, movimientos/[name]
  - [x] B6: title="Volver Arriba" → aria-label i18n en back-to-top
  - [x] B7: aria-hidden="true" en SVGs decorativos (parcial — puntos críticos)
  - [x] B8: role="dialog" + aria-modal + focus trap en modal de búsqueda global
  - [x] B9: button-inside-a → div + absolute a + button con z-index en cards de index
  - [x] B10: width/height en imágenes prev/next de navegación Pokémon
