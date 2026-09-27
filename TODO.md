# TODO - Pokepedia

## En Progreso

_ninguna_

## Pendientes

### Fase siguiente (propuesta, no empezada)
- [ ] **Game Context — extender a más consumidores**: base ya implementada (`src/services/gameContext.ts`, `MovesTable` la consume; ver `docs/architecture/game-context.md`). Pendiente: métodos de aprendizaje, MT/TR/MO, disponibilidad, localizaciones y Pokédex regional sobre `availableContextsForPokemon`/`defaultGameContextForPokemon`.
- [ ] Re-verificar la tabla de revisiones/DLC de Game Context (`REVISION_OF` en `gameContext.ts`) cuando PokeAPI publique datos de movimientos específicos de una DLC: hoy ningún Pokémon real tiene `the-teal-mask`/`the-indigo-disk`/`the-isle-of-armor`/`the-crown-tundra`/`mega-dimension` en `moves[].version_group_details` (verificado en vivo 2026-09-27), así que el plegado DLC→juego base es correcto pero no se ejerce con datos reales todavía.
- [ ] Deuda UX heredada de Fase 1 (no bloqueante): el handler de Enter en la búsqueda de home (`src/pages/[lang]/index.astro`) puede navegar a un enlace de sugerencias oculto (el contenedor tiene `hidden` pero el `<a>` sigue en el DOM). No corregido en Fase 2: requeriría añadir jsdom/happy-dom como dependencia de test para cubrirlo con un test aislado, lo que excede el scope de esta fase.
- [ ] Datos factuales del Pokémon: base implementada (entrenamiento, cría, grupos huevo, género, ratio de captura, EVs, Pokédex regional; ver `docs/architecture/pokemon-entity.md`). Pendiente si aporta valor real: clasificación de variedades (Mega/Gigamax/regional) más allá de nombre+sprite+enlace, `color`/`shape`/`habitat` de la especie (descartados deliberadamente en Fase 2B por falta de tabla de traducción y bajo valor percibido), `evolves_from_species` como relación explícita (la cadena evolutiva ya lo cubre).
- [ ] Enriquecer movimientos (contacto, objetivo, generación, historial de MT, retroceso/drenaje, cambios de stats, multigolpe) y habilidades (efecto exacto, cambios históricos, normal vs oculta).
- [ ] Relaciones completas y filtrables entre entidades (Pokémon ↔ movimientos ↔ habilidades ↔ objetos ↔ tipos ↔ generaciones), con la versión cuando dependan de ella.
- [ ] Mover los tests que siguen en `src/pages/` fuera de esa carpeta: Astro los empaqueta como rutas y crean un chunk `test.*.mjs` (~654 KB) en el worker.
- [ ] Ejecutar `npm run data:catalogs:check` en CI (necesita red; hoy solo manual).
- [ ] Optimizaciones adicionales de catálogos (tamaño del índice de búsqueda, marcado por fila en `/movimientos/`).
- [ ] 914 de 2222 objetos no tienen descripción en PokeAPI en ningún idioma: sus tarjetas no muestran descripción (revisar al regenerar los catálogos).

### Features (Sección C — reclasificada el 2026-09-26)
Decisión de producto: Pokepedia es la enciclopedia; tipos → PokeTypes, construcción/estrategia → PokeStudio.
- ~~**C1 — Inline type effectiveness calculator**~~ **Descartada en Pokepedia**: pertenece a PokeTypes (se mantiene solo el enlace).
- ~~**C3 — Team Builder**~~ **Descartada en Pokepedia**: pertenece a PokeStudio.
- ~~**C7 — Integración profunda poketypes.app (iframe/API)**~~ **Descartada como dirección preferente**: enlace profundo, sin iframe ni duplicación.
- [ ] **C2 — PWA offline cache** (prioridad baja): Service Worker compatible con Cloudflare Workers.
- [ ] **C4 — Comparador ampliado** (prioridad baja): más de 2 Pokémon en `/[lang]/comparar/[p1]/[p2]`.
- [ ] **C5 — Página de generaciones/regiones con mapa** (posterior a Game Context y localizaciones).

## Completados

- [x] **Fase 2B Ficha Pokémon factual (2026-09-27)**: `src/utils/pokemonFacts.ts` (entrenamiento, cría, clasificación, Pokédex regional) y `src/services/pokedexes.ts` (tabla de las 35 pokédex de PokeAPI, verificada en vivo) normalizados sobre datos ya descargados (sin peticiones nuevas). Ver `docs/architecture/pokemon-entity.md`.
- [x] **Fase 2 Game Context — base (2026-09-27)**: `src/services/gameContext.ts` (juego/familia vs revisión de datos, clasificación main-series/spin-off/battle, resolución de contexto por defecto), persistencia en `localStorage` (`src/utils/gameContextStorage.ts`), `MovesTable` refactorizado para consumirlo (selector por Game Context, no por version group crudo), analítica `game_context_change`. Ver `docs/architecture/game-context.md`.
- [x] **Fase 1 enciclopedia (2026-09-26)**: versión por defecto de movimientos, copy alineado con el ecosistema, búsqueda global multi-entidad, catálogos generados y SSR de los índices (ver `docs/audits/encyclopedia-phase1.md`).
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
- [x] **C6 — Sets competitivos Smogon**: `getSmogonSets()` desde `pkmn.github.io/smogon/data/sets/{format}.json`. Tier → formato. Moves/items traducidos via PokeAPI SSR. Natures via mapa estático. Abilities reutilizan fetch ya existente. Renderizado 100% SSR en `CompetitiveSets.astro`.
- [x] **C8 — Historial de búsqueda**: `pokepedia_history` en localStorage (máx 8). Se guarda al visitar `/pokemon/[name]`. Se muestra en el modal de búsqueda global cuando el input está vacío o tiene < 2 chars. Botón "Limpiar".
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
