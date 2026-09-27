# TODO - Pokepedia

## En Progreso

_ninguna_

---

## Phase 2 — CERRADA (2026-09-28)

Fase 2 (enciclopedia factual: entidades enriquecidas, Game Context,
relaciones entre entidades) se da por **cerrada** con esta auditoría final
(Fase 2F). Las tres listas siguientes son la fuente de verdad de qué se
hizo, qué se investigó y se descartó con evidencia, y qué queda fuera del
alcance de Phase 2 por ser producto futuro.

### Phase 2 completed

- [x] **Fase 2 Game Context — base**: `src/services/gameContext.ts`
  (familia de juego vs. revisión de datos, main-series/spin-off/battle,
  contexto por defecto), persistencia en `localStorage`
  (`utils/gameContextStorage.ts`), `MovesTable` como primer consumidor.
  Ver `docs/architecture/game-context.md`.
- [x] **Fase 2B Ficha Pokémon factual**: `utils/pokemonFacts.ts`
  (entrenamiento, cría, clasificación, Pokédex regional),
  `services/pokedexes.ts` (35 pokédex verificadas en vivo). Ver
  `docs/architecture/pokemon-entity.md`.
- [x] **Fase 2C Movimientos + Habilidades + Relaciones**:
  `utils/moveFacts.ts` / `utils/abilityFacts.ts` (mecánicas, target,
  ailment, stat changes, past_values/effect_changes),
  `data/generated/machines.json` (MT/MO/TR, 2372 filas, 0 peticiones
  runtime), `PokemonRelationList.astro`. Corrige el contador de Pokémon de
  la ficha de habilidad (mostraba el total truncado). Ver
  `docs/architecture/move-ability-entities.md`.
- [x] **Fase 2D Relaciones Pokémon ↔ movimiento**:
  `data/generated/learnsets/{move}.json` (833 movimientos, 638.321
  relaciones, 1351 Pokémon, determinista, verificado con `--check`),
  `services/moveLearnsets.ts`, `utils/moveLearnMethods.ts`,
  `utils/moveLearnsetFacts.ts`. Selector de contexto/método client-side
  sin peticiones adicionales. Corregido post-review: selector reactivo por
  Game Context, "Total histórico" reactivo, pruning de learnsets
  obsoletos. Ver `docs/architecture/move-learnset-relations.md`.
- [x] **Fase 2E Pokédex regional contextualizada por Game Context**:
  `regionalDexEntriesForContext` (`utils/pokemonFacts.ts`),
  `services/pokedexes.ts` gana `versionGroups`/`global` por dex
  (verificado en vivo contra las 35 `/pokedex/{name}`). Una única
  computación de Game Context por página, compartida con `MovesTable` (sin
  segundo selector); reactividad vía evento DOM mínimo
  (`pokepedia:game-context-change`) sin condición de carrera (la sección
  resuelve su propio estado inicial de forma independiente). Corregido
  post-review: cleanup de listener con `AbortController` en View
  Transitions, render client-side sin `innerHTML`. Ver
  `docs/architecture/game-context.md` §12.
- [x] **Fase 2F — cierre de la enciclopedia factual**:
  - **Históricos reales de stats/EV yield**: `pokemon.past_stats` (real,
    verificado en vivo — Gen I de Bulbasaur, stat `special` unificada) vía
    `pastStatChanges()`, sección "Cambios históricos" en la ficha Pokémon.
    Ver `docs/architecture/pokemon-entity.md` §8.
  - **Flags factuales de movimiento**: `data/generated/move-flags.json`
    (Showdown `moves.json`, un único fetch, emparejado por id de
    movimiento; 711 de 937 movimientos con al menos un flag factual —
    contacto, sonido, puño, mordisco, pulso, bala, danza, corte, viento,
    bloqueable con Protección — 12.8 KB, determinista).
    `utils/moveFlags.ts` documenta qué flags de Showdown se excluyeron
    (mecánicas de combate/competitivas) y por qué. Ver
    `docs/architecture/move-ability-entities.md` §3.
  - **Relación Item → Generación**: `introducedGeneration` en el catálogo
    de objetos y en la ficha de objeto, desde `item.game_indices` (ya
    descargado, 0 peticiones nuevas).
  - **Deuda técnica**: los 16 tests que vivían en `src/pages/` (empaquetados
    por Astro como rutas reales, generaban un chunk `test.*.mjs` de
    ~654 KB en el worker) movidos a `src/testing/`. Confirmado con `npm
    run build`: ya no aparece ningún fichero `*test*` en `dist/`.

### Deferred by evidence

Investigado en profundidad, **no implementado**, con evidencia concreta —
no descartado por pereza ni por falta de tiempo:

- [ ] **Encuentros / localizaciones / disponibilidad real por juego**
  (Fase 2F, 2026-09-28): `/pokemon/{id}/encounters` mide entre 6.5 KB y
  ~957 KB por Pokémon (Magikarp) — un dataset offline al estilo
  `learnsets/` costaría un orden de magnitud más que el propio
  `learnsets/` (ya el más caro del proyecto). `location-area` (1539
  recursos) y `encounter-method` (66) no tienen **ninguna** traducción al
  español en PokeAPI (verificado en vivo sobre varias muestras). Los
  encuentros se indexan por `version`, no por `version_group` — haría
  falta un mapeo nuevo que hoy no existe. Una versión reducida ("solo
  lista de juegos", sin localización/método) se consideró y se descartó
  también: duplicaría lo que el propio selector de `MovesTable` ya
  transmite. `src/utils/pokemon.ts` conserva traducciones muertas de un
  intento anterior nunca conectado (`encounterTranslations`,
  `encounters_title`) — se dejan intactas hasta que esta feature se
  aborde de verdad (no se eliminan "de paso"). Ver
  `docs/architecture/pokemon-entity.md` §10. Candidata a una futura fase,
  no numerada todavía.
- [ ] **Históricos de amistad base / ratio de captura / experiencia base**:
  re-verificado en vivo 2026-09-28 — son valores planos en
  `pokemon-species`/`pokemon`, sin ningún campo `past_*` equivalente en
  ningún sitio del schema de PokeAPI (a diferencia de EV yield/stats, que
  sí lo tienen — ya implementado en Fase 2F). Showdown tampoco aporta
  histórico multi-generación. La ficha sigue mostrando el valor actual
  correctamente, sin inventar ni reconstruir históricos por regla. Ver
  `docs/architecture/pokemon-entity.md` §8.
- [ ] **Clasificación estructurada de formas (Mega/Gigamax/regional)**:
  el dato SÍ existe y es estructurado (`pokemon-form.is_mega`,
  `is_battle_only`, `form_name === 'gmax'`, `form_names` con `es` reales —
  verificado en vivo), pero vive en el recurso `pokemon-form`, no en
  `varieties` — requeriría una petición adicional por variedad no hecha
  hoy. La etiqueta actual por sufijo del nombre ("(Mega)"/"(Gigamax)")
  cubre razonablemente los casos comunes. Ver
  `docs/architecture/pokemon-entity.md` §9.
- [ ] **`npm run data:catalogs:check` en CI**: evaluado y descartado por
  ahora — necesita red hacia PokeAPI en cada ejecución de CI, lo que
  introduciría fragilidad externa al pipeline (un fallo de PokeAPI, no del
  código, rompería builds). Además, para `learnsets`/`move-flags` el
  check es deliberadamente ligero (solo cuenta), no una revalidación
  completa — ver `docs/architecture/move-learnset-relations.md` §2. Se
  mantiene como comando manual (`npm run data:catalogs:check`).
- [ ] **Objetos ↔ tipos ↔ generaciones**: la relación Item → Generación SÍ
  se materializó (Fase 2F, arriba, vía `game_indices`). Objeto ↔ Tipo no
  tiene un campo estructurado real en PokeAPI (los objetos no tienen
  `type`; la asociación con un tipo, cuando existe — p. ej. Fragmento de
  Fuego — vive solo en el texto del efecto, no en un campo). No se crea
  una relación artificial sin datos que la respalden.
- [ ] Re-verificar la tabla de revisiones/DLC de Game Context
  (`REVISION_OF` en `gameContext.ts`) cuando PokeAPI publique datos de
  movimientos específicos de una DLC: hoy ningún Pokémon real tiene
  `the-teal-mask`/`the-indigo-disk`/`the-isle-of-armor`/
  `the-crown-tundra`/`mega-dimension` en `moves[].version_group_details`
  (verificado en vivo 2026-09-27). El plegado DLC→juego base sí se
  confirmó con datos reales en otro dominio (Pokédex regional de Pikachu,
  Fase 2E: `isle-of-armor` junto a `galar`).
- [ ] 914 de 2222 objetos no tienen descripción en PokeAPI en ningún
  idioma: limitación de la fuente, no un bug — sus tarjetas simplemente no
  muestran descripción.

### Future product features

Fuera del alcance de Phase 2 por ser producto/herramienta futura, no
deuda factual pendiente:

- [ ] **C2 — PWA offline cache** (prioridad baja): Service Worker
  compatible con Cloudflare Workers.
- [ ] **C4 — Comparador ampliado** (prioridad baja): más de 2 Pokémon en
  `/[lang]/comparar/[p1]/[p2]`.
- [ ] **C5 — Página de generaciones/regiones con mapa**.
- ~~**C1 — Inline type effectiveness calculator**~~ **Descartada en
  Pokepedia**: pertenece a PokeTypes (se mantiene solo el enlace).
- ~~**C3 — Team Builder**~~ **Descartada en Pokepedia**: pertenece a
  PokeStudio.
- ~~**C7 — Integración profunda poketypes.app (iframe/API)**~~
  **Descartada como dirección preferente**: enlace profundo, sin iframe ni
  duplicación.
- No implementadas ni planificadas dentro de Pokepedia: calculadora de
  efectividades, Team Builder, contenido competitivo propio, blog, páginas
  SEO programáticas artificiales.

---

## Pendientes (no relacionadas con Phase 2)

- [ ] Optimizaciones adicionales de catálogos (tamaño del índice de
  búsqueda, marcado por fila en `/movimientos/`).

## Completados (legacy, pre-Phase 2)

- [x] **UX polish enciclopedia (2026-09-27)**: nombres de Pokédex regional
  completos (sin truncar), categoría de especie contextualizada
  ("Categoría: Pokémon Mach"), y decisión de arquitectura: el buscador
  grande de la home pasa a ser un filtro **local** de la Pokédex/
  generación actual (nunca búsqueda global) — se elimina el dropdown de
  autocompletado global de `index.astro`. Corrección post-revisión:
  `GENERATIONS.region` pasó a ser bilingüe (`{es, en}`) centralizado en
  `generationRegionLabel()`. Ver `docs/architecture/home-search-scope.md`.
- [x] Deuda UX heredada de Fase 1: el handler de Enter en la búsqueda de
  home podía navegar a un enlace de sugerencias oculto. **Resuelta de
  raíz en la fase de UX polish**: el mecanismo que la causaba (el dropdown
  de autocompletado global en `index.astro`) se ha eliminado por completo.
  Ver `docs/architecture/home-search-scope.md`.
- [x] **Fase 1 enciclopedia (2026-09-26)**: versión por defecto de
  movimientos, copy alineado con el ecosistema, búsqueda global
  multi-entidad, catálogos generados y SSR de los índices (ver
  `docs/audits/encyclopedia-phase1.md`).
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
