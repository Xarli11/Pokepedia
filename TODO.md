# TODO - Pokepedia

## En Progreso

_ninguna_

## Pendientes

### Fase siguiente (propuesta, no empezada)
- [ ] **Game Context**: recordar el juego/version group elegido y aplicarlo a learnsets, MT/TR/MO, localizaciones y Pokédex regional (`MovesTable.initialVersion` y la identidad `{type, slug}` de búsqueda/historial son los puntos de enganche).
- [ ] Completar datos factuales del Pokémon (entrenamiento, cría, grupos huevo, género, ratio de captura, EVs, Pokédex regional).
- [ ] Enriquecer movimientos (contacto, objetivo, generación, historial de MT, retroceso/drenaje, cambios de stats, multigolpe) y habilidades (efecto exacto, cambios históricos, normal vs oculta).
- [ ] Relaciones completas y filtrables entre entidades (Pokémon ↔ movimientos ↔ habilidades ↔ objetos ↔ tipos ↔ generaciones), con la versión cuando dependan de ella.
- [ ] Mover los tests que siguen en `src/pages/` fuera de esa carpeta (Astro los empaqueta como rutas).

### Features (Sección C — reclasificada el 2026-09-26)
Decisión de producto: Pokepedia es la enciclopedia; tipos → PokeTypes, construcción/estrategia → PokeStudio.
- ~~**C1 — Inline type effectiveness calculator**~~ **Descartada en Pokepedia**: pertenece a PokeTypes (se mantiene solo el enlace).
- ~~**C3 — Team Builder**~~ **Descartada en Pokepedia**: pertenece a PokeStudio.
- ~~**C7 — Integración profunda poketypes.app (iframe/API)**~~ **Descartada como dirección preferente**: enlace profundo, sin iframe ni duplicación.
- [ ] **C2 — PWA offline cache** (prioridad baja): Service Worker compatible con Cloudflare Workers.
- [ ] **C4 — Comparador ampliado** (prioridad baja): más de 2 Pokémon en `/[lang]/comparar/[p1]/[p2]`.
- [ ] **C5 — Página de generaciones/regiones con mapa** (posterior a Game Context y localizaciones).

## Completados

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
