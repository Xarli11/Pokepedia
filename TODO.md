# TODO - Pokepedia

## En Progreso

_ninguna_

## Pendientes

### Fase siguiente (propuesta, no empezada)
- [x] **Game Context — extender a más consumidores existentes**: `MovesTable`, la ficha de movimiento (Fase 2D, métodos/MT-TR-MO) y, desde Fase 2E (2026-09-28), la Pokédex regional de la ficha Pokémon (`regionalDexEntriesForContext`, ver `docs/architecture/game-context.md` §12) ya reutilizan `availableContextsForPokemon`/`defaultGameContextForPokemon` — un único cálculo por página, sin selector duplicado. **Precisión importante**: esto resuelve la deuda de "reutilizar Game Context entre consumidores ya existentes", no la disponibilidad/capturabilidad real por juego — `availableContextsForPokemon` solo dice "para qué contextos hay datos de movimientos de este Pokémon", nunca "en qué juego se puede conseguir". Esa pregunta sigue abierta (ver el punto de localizaciones/encuentros justo abajo).
- [ ] **Game Context — disponibilidad/obtención real (localizaciones y encuentros)** (no iniciada, candidata a Fase 2F): requiere `/pokemon/{id}/encounters` (fetch nuevo, no construido), una tabla de traducción de `location-area` (cientos de valores, no verificada), y un mapeo `version` (no `version_group`) → Game Context que hoy no existe (los encuentros de PokeAPI se indexan por `version`, un nivel más granular que `version_group`). Antes de empezar: investigar en vivo coste/tamaño del endpoint, semántica exacta de `version_details`, y si un dataset offline (estilo `learnsets/`, Fase 2D) es necesario o si es viable en runtime. `src/utils/pokemon.ts` ya tiene traducciones muertas de un intento anterior nunca conectado (`encounterTranslations`, `encounters_title`) — decidir si se reutilizan o se eliminan al abordar esto, no antes.
- [ ] Re-verificar la tabla de revisiones/DLC de Game Context (`REVISION_OF` en `gameContext.ts`) cuando PokeAPI publique datos de movimientos específicos de una DLC: hoy ningún Pokémon real tiene `the-teal-mask`/`the-indigo-disk`/`the-isle-of-armor`/`the-crown-tundra`/`mega-dimension` en `moves[].version_group_details` (verificado en vivo 2026-09-27), así que el plegado DLC→juego base es correcto pero no se ejerce con datos reales todavía.
- [x] Deuda UX heredada de Fase 1: el handler de Enter en la búsqueda de home podía navegar a un enlace de sugerencias oculto. **Resuelta de raíz en la fase de UX polish (2026-09-27)**: el mecanismo que la causaba (el dropdown de autocompletado global en `index.astro`) se ha eliminado por completo — el buscador de home ya no tiene sugerencias ni `<a>` de resultado al que Enter pudiera navegar. Ver `docs/architecture/home-search-scope.md`.
- [ ] Datos factuales del Pokémon: base implementada (entrenamiento, cría, grupos huevo, género, ratio de captura, EVs, Pokédex regional; ver `docs/architecture/pokemon-entity.md`). Pendiente si aporta valor real: clasificación de variedades (Mega/Gigamax/regional) más allá de nombre+sprite+enlace, `color`/`shape`/`habitat` de la especie (descartados deliberadamente en Fase 2B por falta de tabla de traducción y bajo valor percibido), `evolves_from_species` como relación explícita (la cadena evolutiva ya lo cubre).
- [ ] **Game Context — historical Pokémon facts** (no iniciada): `PokemonFacts` (Fase 2B) muestra el valor **actual** que PokeAPI expone para cada especie, no un histórico versionado — PokeAPI no expone historial por version group para estos campos como sí hace con `past_values` en movimientos. Variación histórica real confirmada (no todos necesariamente justifican un dataset versionado; a evaluar caso por caso): amistad base (cambios desde Gen VIII para varias especies), EV yield (cambios entre generaciones para algunas especies), ratio de captura (cambios entre juegos para algunas especies), experiencia base (cambios históricos para algunas especies). Ver `docs/architecture/pokemon-entity.md` §8.
- [x] Enriquecer movimientos (objetivo, generación, MT/MO/TR, retroceso/drenaje, cambios de stats, multigolpe, cambios históricos) y habilidades (efecto vs. flavor, cambios históricos, normal vs oculta) — **Fase 2C (2026-09-27)**, ver `docs/architecture/move-ability-entities.md`.
- [ ] **Flags de movimiento** (contacto, bloqueado por Protect, sonido, puño, mordisco, polvo, pulso, bala, danza, corte, viento...): investigado en Fase 2C, PokeAPI no los expone en absoluto (`move.meta` no tiene ningún campo de flags, verificado en vivo contra Earthquake). Showdown sí los tiene (`movedex[].flags`), pero integrarlos es una fuente de datos nueva (propia caché/generación/tabla de traducción de flags) no construida en esta fase.
- [x] **Relación Pokémon → movimiento con método/nivel** (p. ej. "Garchomp — Nivel 40") — **Fase 2D (2026-09-27)**, ver `docs/architecture/move-learnset-relations.md`.
- [x] Relaciones completas y filtrables entre entidades (Pokémon ↔ movimientos ↔ habilidades): grafo parcial materializado en Fase 2C (`Move --introducedIn--> Generation`, `Move --machineIn--> Item+VersionGroup`, `Ability --relatesTo--> Pokemon` con normal/oculta). Pendiente: objetos ↔ tipos ↔ generaciones, y filtros de UX sobre las relaciones ya existentes (por juego/Game Context, por método).
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

- [x] **Fase 2E Pokédex regional contextualizada (2026-09-28)**: la sección de Pokédex regional de la ficha Pokémon se filtra por el Game Context activo, reutilizando el selector ya existente de `MovesTable` (sin selector ni abstracción paralela). `src/services/pokedexes.ts` gana `versionGroups`/`global` por dex (verificado en vivo contra las 35 `/pokedex/{name}`; solo `national` es global, `conquest-gallery` queda excluido antes de llegar al filtro). `regionalDexEntriesForContext` (`utils/pokemonFacts.ts`) es la función pura de filtrado. Una única computación de Game Context por página (antes solo la calculaba `MovesTable`); reactividad client-side vía un evento DOM mínimo (`pokepedia:game-context-change`) que `MovesTable` emite en cada cambio de contexto (inicial, restaurado desde `localStorage`, manual), sin condición de carrera: la sección de Pokédex regional resuelve su propio estado inicial de forma independiente, nunca depende de capturar ese primer evento. "Total histórico" reutiliza la semántica ya corregida en Fase 2D (siempre presente, nunca omitido condicionalmente en SSR). 0 peticiones PokeAPI nuevas. Explícitamente NO resuelve disponibilidad/capturabilidad real ni localizaciones/encuentros (ver el punto correspondiente más arriba). Ver `docs/architecture/game-context.md` §12.
- [x] **Fase 2D Relaciones Pokémon ↔ movimiento (2026-09-27)**: `src/data/generated/learnsets/{move}.json` (dataset offline generado desde 1351 `pokemon/{id}`, 833 movimientos, 638.321 relaciones, opt-in vía `npm run data:catalogs -- --only=move-learnsets`, verificado determinista y validado con `--check`), `src/services/moveLearnsets.ts`, `src/utils/moveLearnMethods.ts`, `src/utils/moveLearnsetFacts.ts`. La ficha de movimiento muestra quién lo aprende, cómo y en qué Game Context, con selector de contexto/método client-side sin peticiones adicionales. Ver `docs/architecture/move-learnset-relations.md`.
- [x] **UX polish enciclopedia (2026-09-27)**: nombres de Pokédex regional completos (sin truncar), categoría de especie contextualizada ("Categoría: Pokémon Mach"), y decisión de arquitectura: el buscador grande de la home pasa a ser un filtro **local** de la Pokédex/generación actual (nunca búsqueda global) — se elimina el dropdown de autocompletado global de `index.astro`. Corrección post-revisión: `GENERATIONS.region` pasó a ser bilingüe (`{es, en}`) centralizado en `generationRegionLabel()` (antes un parche local solo en el placeholder dejaba la píldora de Gen 5 en "Teselia" también en EN); corrige también la página de generación, el hub de generaciones y la imagen OG. Ver `docs/architecture/home-search-scope.md`.
- [x] **Fase 2C Movimientos + Habilidades + Relaciones (2026-09-27)**: `src/utils/moveFacts.ts` (mecánicas, target, ailment, stat changes, past_values), `src/utils/abilityFacts.ts` (efecto vs. flavor, effect_changes), `src/data/generated/machines.json` + `src/services/machines.ts` (MT/MO/TR, 2372 filas, 0 peticiones en runtime), `PokemonRelationList.astro` (lista ligera, sin tier competitivo). Corrige bug real: el contador de Pokémon de la ficha de habilidad mostraba el total truncado, no el real. Ver `docs/architecture/move-ability-entities.md`.
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
