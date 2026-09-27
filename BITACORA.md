# BITACORA - Pokepedia

---

## 2026-09-28 (Sesión 15 — Fase 2F: cierre de Phase 2, enciclopedia factual)

**Objetivo:** cerrar Phase 2 definitivamente sobre
`feature/phase2-final-factual-encyclopedia` (partiendo de `develop` con
2D y 2E ya mergeadas, PRs #18 y #19). Auditar TODO lo pendiente
razonablemente ligado a Phase 2 e implementar lo viable en la misma fase,
sin abrir 2G/2H por cada detalle, pero sin convertir esto en "todo el
TODO del repositorio".

**Auditoría en vivo antes de implementar nada** (evidencia real, no
suposiciones):

- `/pokemon/{id}/encounters`: 6.5 KB (Bulbasaur) a ~957 KB (Magikarp).
  `location-area` (1539 recursos, 5 muestras) y `encounter-method` (66,
  todos) sin ninguna traducción `es`. Encuentros indexados por `version`,
  no `version_group`. **Decisión: diferir con evidencia**, no implementar
  — ni siquiera una versión reducida de "disponibilidad" (duplicaría el
  selector de `MovesTable`).
- `pokemon.past_stats`: descubierto real y viable en vivo (Bulbasaur Gen I,
  stat `special` unificada, con `effort`). `base_happiness`/
  `capture_rate`/`base_experience`: re-confirmado que NO tienen ningún
  campo `past_*` en el schema. **Decisión: implementar EV yield/stats,
  diferir el resto con evidencia.**
- Showdown `moves.json`: 490 KB, 954 movimientos, 37 flags distintos,
  `num` = id de PokeAPI (verificado: Tackle #33, Earthquake #89 coinciden).
  **Decisión: implementar** un subconjunto factual curado de 11 flags
  (excluyendo los de mecánica de combate/competitivos).
- `item.game_indices`: ya descargado en cada detalle de objeto.
  **Decisión: implementar** `Item --introducedIn--> Generation`.
- `pokemon-form` (Mega/Gigamax/regional): datos reales y estructurados
  (`is_mega`, `form_name: 'gmax'`, `form_names` con `es`), pero requieren
  una petición extra por variedad no hecha hoy. **Decisión: diferir con
  evidencia**, mantener el etiquetado actual por sufijo de nombre.
- `data:catalogs:check` en CI: necesita red hacia PokeAPI en cada run.
  **Decisión: no añadir**, documentado.
- Objetos ↔ tipos: los objetos no tienen campo `type` estructurado.
  **Decisión: no crear relación artificial.**

**Implementado:**
1. `src/utils/pokemonFacts.ts` (`pastStatChanges`) + sección "Cambios
   históricos" en la ficha Pokémon.
2. `scripts/generate-catalogs.ts` (`buildMoveFlags`) →
   `src/data/generated/move-flags.json` (711/937 movimientos, 12.8 KB,
   determinista verificado con dos ejecuciones), `src/utils/moveFlags.ts`,
   `src/services/moveFlagsData.ts`, badges en la ficha de movimiento.
3. `ItemEntry.introducedGeneration` (catálogo + ficha de objeto), desde
   `game_indices` ya descargado. Catálogos de objetos regenerados (ES/EN,
   2222 objetos reales), determinismo verificado.
4. Deuda técnica: 16 ficheros de test movidos de `src/pages/` a
   `src/testing/` (Astro los empaquetaba como rutas reales +
   `test.*.mjs` de ~654 KB). Confirmado con `npm run build`: 0 ficheros
   `*test*` en `dist/`.

**Validación live** (dev server, datos reales): Bulbasaur → "Generación I
y anteriores: Especial 65"; Tackle → Contacto + Bloqueable con
Protección; Earthquake → solo Bloqueable con Protección (sin Contacto);
Master Ball → "Generación I". ES y EN verificados. `fetch-budget.ssr.test.ts`
confirma 0 peticiones PokeAPI nuevas.

**TODO.md reestructurado** en tres secciones: Phase 2 completed / Deferred
by evidence / Future product features — permite decir honestamente que
Phase 2 está cerrada.

**Próximos pasos:** validación final completa, commits de documentación,
sin PR hasta nueva instrucción.

---

## 2026-09-27 (Sesión 14 — Fase 2E: Pokédex regional contextualizada por Game Context)

**Objetivo:** implementar la Fase 2E sobre `feature/game-context-regional-dex-phase2e`
(partiendo de `develop` ya con la Fase 2D mergeada, PR #18): la sección de
Pokédex regional de la ficha Pokémon se filtra por el Game Context activo,
reutilizando el selector ya existente de `MovesTable`, sin crear un
segundo control ni una segunda implementación del algoritmo de Game
Context.

**Auditoría previa a implementar** (obligatoria antes de tocar código):
verificados en vivo los 35 `/pokedex/{name}` reales. Solo dos dexes
devuelven `version_groups: []`: `national` (decisión explícita: `global:
true`, es el índice cruzado por definición) y `conquest-gallery` (`global:
false` — ya excluido de la Pokédex regional antes de que el filtro por
contexto se ejecute nunca, por `isMainSeriesPokedex`). Las otras 33 dexes
tienen al menos un version group real — no queda ningún caso vacío sin
decidir.

**Implementado:**
- `src/services/pokedexes.ts`: `PokedexMeta` gana `versionGroups`/`global`
  (dato hand-verified, mismo rigor que el resto de la tabla).
- `src/utils/pokemonFacts.ts`: `regionalDexEntriesForContext` (función
  pura, mismo estilo que `relationsForContext` de Fase 2D). Un dex sin
  metadata en la tabla nunca se oculta (fail-open, igual que `pokedexLabel`
  con un nombre desconocido).
- `src/utils/movesPayload.ts`: `versionGroupsFromMoveDetails` extraído para
  que la página y `MovesTable` deriven la lista cruda de version groups de
  forma idéntica (nunca dos copias del algoritmo de Game Context en sí,
  que sigue viviendo solo en `gameContext.ts`).
- `src/components/MovesTable.astro`: acepta `availableContexts`/
  `defaultContext` opcionales (calculados por la página); si no se pasan,
  los sigue calculando internamente (tests existentes sin cambios). Su
  script cliente emite `pokepedia:game-context-change` en cada resolución
  de contexto (inicial + restaurado desde `localStorage`, y en cada cambio
  manual).
- `src/pages/[lang]/pokemon/[name].astro`: calcula Game Context una única
  vez, lo pasa a `MovesTable`, renderiza la Pokédex regional ya filtrada
  en SSR, y tiene su propio script que escucha el evento — pero resuelve
  su estado inicial de forma **independiente** (misma función pura
  `resolveContextForPokemon`, misma clave de `localStorage`), evitando una
  condición de carrera con el script de `MovesTable` (los módulos se
  ejecutan en orden de documento; el de `MovesTable` va antes y emite de
  forma síncrona, así que un listener registrado después ya habría perdido
  ese primer evento si dependiera de él).
- "Total histórico" reutiliza exactamente la semántica corregida en Fase
  2D: siempre presente en el DOM, nunca omitido condicionalmente en SSR.

**Validación manual con datos reales** (Pikachu, elegido tras inspeccionar
en vivo `pokemon-species/25`, con entradas en prácticamente todos los
Game Context): por defecto (Escarlata/Púrpura) muestra Nacional + Paldea +
Kitakami (3 de 20 históricas); simulada la lógica pura contra Espada/
Escudo → Galar + Isla de la Armadura (confirma en datos reales que el
plegado de DLC también aplica a Pokédex regional, no solo a movimientos);
Let's Go Pikachu/Eevee → Let's Go Kanto; Leyendas: Arceus → Hisui. ES y EN
verificados. Confirmado con `fetch-budget.ssr.test.ts` que no se añadió
ninguna petición PokeAPI nueva.

**Verde:** `npm test` (861 pasan, 2 skipped, 0 fallos — +22 sobre el
estado post-2D), `npm run check` (0 errores), `npm run build`.

**Fuera de alcance, documentado como deuda futura (posible Fase 2F, no
iniciada):** localizaciones/encuentros (`/pokemon/{id}/encounters`,
traducciones de `location-area`, mapeo `version` → Game Context). Se deja
constancia explícita de que Game Context (derivado de
`pokemon.moves[].version_group_details`) no equivale a disponibilidad o
capturabilidad real por juego.

**Próximos pasos:** revisión, sin PR abierta ni merge (instrucción
explícita de esta fase).

---

## 2026-09-27 (Sesión 13 — Fase 2D: correcciones post-review + Cloudflare Preview)

**Objetivo:** cerrar los hallazgos de una revisión externa de la PR #18 +
validación visual real en Cloudflare Branch Preview, sobre la misma rama
`feature/move-learnset-relations-phase2d`, sin abrir fase ni PR nuevas.

**Bug 1 confirmado visualmente (Outrage, Escarlata/Púrpura → Platino,
Tutor nunca aparecía):** `availableMethods` se calculaba una sola vez en
SSR desde el contexto por defecto; el `<select>` de método nunca se
reconstruía al cambiar de Game Context, aunque el listado sí se
recalculaba. Corregido: el script cliente ahora recalcula
`methodsPresent(relationsForContext(...))` (mismas funciones puras que ya
usaba el SSR) en cada cambio de contexto — al cargar, al restaurar desde
`localStorage` y al elegir otro juego — reconstruyendo las opciones,
reseteando el filtro a "Todos" y ocultando el control si el contexto
resultante tiene un único método. `methodsPresent()` ahora ordena por
`LEARN_METHOD_ORDER` en vez de por orden de inserción (antes dependía
accidentalmente del orden de las relaciones).

**Bug 2 (Total histórico no reaccionaba a cambios):** era un elemento
condicional en SSR (`{condición && <span>}`) — si no se renderizaba en el
contexto por defecto, ningún cambio de contexto podía hacerlo aparecer.
Ahora siempre se renderiza, con `class="hidden"` controlada por el
cliente, y solo se muestra sin filtro de método activo (para que nunca se
lea como si fuera el total histórico de ese método concreto).

**Bug 3 (dataset: generador no podaba learnsets obsoletos):** si un
movimiento dejaba de tener relaciones en una regeneración futura, su
fichero `learnsets/{move}.json` se quedaba físicamente en el repo y
`import.meta.glob` lo seguiría sirviendo como si fuera actual. Extraída la
lógica de poda a una función pura y testeada
(`src/data/catalogs/learnsetPruning.ts`): el generador ahora construye el
dataset completo en memoria, y solo tras un `buildMoveLearnsets()`
exitoso escribe los ficheros actuales, borra los que ya no pertenecen a la
salida nueva (limitado estrictamente a `learnsets/`) y retira sus hashes
del manifest global. Demostrado en vivo: fichero ficticio
`totally-fake-stale-move.json` creado a mano, regenerado el dataset, el
fichero desaparece y su hash no sobrevive en `manifest.json`.

**Cifras corregidas:** un comentario en `generate-catalogs.ts` seguía
citando una estimación previa (5.4 MB raw / ~0.59-0.69 MB gzip) distinta
de las cifras reales medidas en la Sesión 12 (7.6 MB raw / ~0.71 MB gzip,
834 ficheros). Unificado en todos los sitios; documentado explícitamente
que `npm run data:catalogs:check` es una comprobación ligera (solo cuenta
de Pokémon) para learnsets, no una revalidación completa de las 638.321
relaciones — eso solo lo hace una regeneración real.

**Verde:** `npm test` (839 pasan, 2 skipped, 0 fallos — +15 tests sobre la
sesión anterior), `npm run check` (0 errores), `npm run build`.
Regenerado el dataset tras los cambios del generador: mismos 833
movimientos / 638.321 relaciones / 1351 Pokémon / 834 ficheros, sin drift.

**Próximos pasos:** push a la misma rama, mismo PR #18, esperar CI real
(install · check · test · build) y el redeploy de Cloudflare Preview. Sin
merge, sin fase nueva.

---

## 2026-09-27 (Sesión 12 — Fase 2D: relaciones de learnset Pokémon ↔ movimiento)

**Objetivo:** cerrar la Fase 2D (`feature/move-learnset-relations-phase2d`),
retomando trabajo local no commiteado más un backup en patch de una sesión
de Claude Cloud sin acceso a red de PokeAPI.

**Estado recuperado:** el working tree local ya contenía la implementación
completa (servicio `moveLearnsets.ts`, `moveLearnMethods.ts`,
`moveLearnsetFacts.ts`, página de movimiento adaptada, dataset ya generado
en `src/data/generated/learnsets/`) con tests propios (
`moveLearnsets.test.ts`, `moveLearnMethods.test.ts`,
`moveLearnsetFacts.test.ts`) ya en verde. El patch de backup
(`backups/pokepedia-phase2d.patch`, 3 commits) contenía una implementación
paralela equivalente de la misma arquitectura (misma forma de datos,
estilo distinto) más las 4 correcciones de tests heredados que localmente
faltaban. Comparado archivo a archivo contra un worktree temporal con el
patch aplicado: se mantuvo la implementación local (ya funcional y
probada) y se integraron solo las piezas que faltaban.

**Integrado del patch:**
- `src/pages/fetch-budget.ssr.test.ts`, `src/pages/movement-crawlability.ssr.test.ts`,
  `src/testing/moveAbilityEntities.ssr.test.ts`: reescritos para mockear
  `services/moveLearnsets` en vez de asumir `learned_by_pokemon` +
  cap de 30/60 tarjetas (arquitectura ya retirada).
- Bug real encontrado al integrar: el estado vacío del listado
  (`#learnset-empty`) llevaba `class="hidden"` fija en el SSR — un
  crawler o visitante sin JS nunca veía el mensaje "no hay Pokémon...".
  Corregido en `[lang]/movimientos/[name].astro` para que el SSR decida
  la clase `hidden` según `defaultRelationEntries.length`.

**Dataset generado en este entorno** (con acceso real a PokeAPI, a
diferencia de la sesión Cloud que originó el patch):
`npm run data:catalogs -- --only=move-learnsets` → 833 movimientos,
638.321 relaciones, 1351 Pokémon, 834 ficheros (833 + manifest), 7.6 MB
raw / ~0.71 MB gzip. Ejecutado dos veces consecutivas: salida idéntica
byte a byte (determinismo confirmado). `npm run data:catalogs:check`
valida limpio contra PokeAPI en vivo.

**Verde:** `npm test` (824 pasan, 2 skipped, 0 fallos), `npm run check`
(0 errores), `npm run build` (completa sin errores).

**Documentación:** `docs/architecture/move-learnset-relations.md` (nuevo),
`docs/DATA_SOURCES.md`, `TODO.md`, `CHANGELOG.md`.

**Próximos pasos:** push de la rama, PR contra `develop` (sin merge).

---

## 2026-09-27 (Sesión 11 — UX polish: feedback visual real)

**Objetivo:** corregir feedback visual real recibido tras la Fase 2C, antes
de seguir ampliando datasets. Rama `feature/encyclopedia-ux-polish-phase2`,
partiendo de `develop` tras mergear la PR #16.

**Feedback resuelto:**

### 1. Nombres de Pokédex regional cortados
`pokemon/[name].astro`: la celda tenía `truncate` dentro de un `flex
justify-between` que la comprimía contra el número. Quitado `truncate`,
permitido wrap a dos líneas (`leading-snug`, `items-start`), grid con
menos columnas más anchas (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
Verificado con "Ciudad Luminalia" y "Nieves de la Corona" completos, ES y EN.

### 2. "Pokémon Mach" sin contexto
Contextualizado como "Categoría: Pokémon Mach" / "Category: Mach Pokémon",
reutilizando la clave de traducción `category` ya existente (objetos).

### 3. Buscador de home: global vs local (el cambio más importante)
**Decisión de arquitectura, ahora fija:** el buscador de la cabecera sigue
siendo la búsqueda global de entidades (sin cambios). El buscador grande de
`/[lang]/` pasa a ser un **filtro local** de la Pokédex/generación
actualmente mostrada (o de favoritos) — nunca más búsqueda global.

- `utils/homeSearch.ts`: `computeGridVisibility()` pierde la vía de escape
  que dejaba el grid intacto cuando el texto no encontraba nada local (esa
  vía existía solo para que el dropdown global, ahora eliminado, "se hiciera
  cargo" de ese caso). Ahora el texto siempre filtra el grid, incluso hasta
  0 resultados.
- Eliminado por completo de `index.astro` (no solo ocultado): el dropdown
  multi-entidad, la carga del índice global (`loadSearchIndex`/`runSearch`),
  el evento de analítica `global_search`/`home_search`, y el manejador de
  Enter que podía navegar a una sugerencia oculta — **esto resuelve de raíz
  la deuda de Fase 1** sobre esa navegación fantasma, sin necesidad de
  jsdom/happy-dom (el mecanismo que la causaba ya no existe).
- Placeholder contextual: "Buscar Pokémon en Kanto..." / "Search Pokémon in
  Kanto...", o "Buscar en favoritos...". Empty state honesto: 'No hay
  resultados para "Garchomp" en Kanto.' Textos centralizados en
  `uiTranslations` con sustitución `{token}` vía `formatTemplate()`
  (compartida por SSR y el script cliente, para que no diverjan).
- Descubierto de paso, y **corregido tras revisión externa de la PR #17**:
  `GENERATIONS.region` era un string único ES/EN — la píldora de Gen 5
  seguía diciendo "Teselia" en EN aunque el placeholder ya decía "Unova"
  (un primer parche solo tocó el placeholder). Corregido de raíz:
  `GENERATIONS.region` pasa a `{es, en}` y `generationRegionLabel(gen, lang)`
  en `services/pokeapi.ts` es la única función que debe leerlo — usada
  ahora por la home (píldoras + placeholder), la página de generación,
  el hub de generaciones, la imagen OG de generación y el índice de
  búsqueda global (que ya tenía su propia tabla correcta, ahora delegada
  en vez de duplicada). Verificado en vivo: EN/gen5 → "Unova" en píldora,
  placeholder, landing, hub y OG; ES/gen5 → "Teselia" en todos. Tests
  nuevos de regresión ES/EN para gen5 y para gen1/2/3/6 (mismo nombre en
  ambos idiomas).

**Performance:** chunk JS del cliente de la home 9864 → 8793 bytes crudo
(−10.9%), 3948 → 3525 gzip (−10.7%), medido contra `develop` en worktree
aislado. Más importante: la home ya no dispara ninguna petición a
`/search-index/{lang}.json/` (antes ~265 KB crudos / ~73 KB gzip) — verificado
que el HTML servido no contiene ninguna referencia a `loadSearchIndex`.
El buscador global de la cabecera no se ve afectado.

**Tests:** 786 → 805 (19 nuevos: `homeSearch.test.ts` reescrito para el
filtro estrictamente local, `homeSearchScope.ssr.test.ts` nuevo (incluida
la regresión i18n de región), `pokemonEntity.ssr.test.ts` ampliado).
`check`: 0 errores. `build`: OK.

**Verificado en vivo (dev server real, PokeAPI real):** Kanto/Sinnoh/Unova
(ES y EN), favoritos, Garchomp real (categoría + Pokédex regional
completos).

---

## 2026-09-27 (Sesión 10 — Fase 2C: movimientos, habilidades, relaciones)

**Objetivo:** convertir `/movimientos/{slug}/` y `/habilidades/{slug}/` en
fichas factuales completas (mecánicas, generación, MT/MO/TR, cambios
históricos) y mejorar las relaciones Pokémon↔movimiento/habilidad, sin
tocar estrategia competitiva. Rama `feature/move-ability-entities-phase2c`,
partiendo de `develop` tras mergear la PR #15 (correcciones de Fase 2B).

**Auditoría previa:** el contador de la ficha de habilidad mostraba
`pokemonList.length` (el total truncado a 40) como si fuese el total real
— bug real, corregido. El movimiento ya tenía un disclosure honesto
("Mostrando 40"); la habilidad no. Ambas páginas usaban `PokemonCard`
completo (tarjetas grandes, con tier competitivo Smogon).

**Cambios realizados:**

### feat: mecánicas de movimiento (`src/utils/moveFacts.ts`)
- Objetivo, ailment/probabilidad, drenaje/retroceso (el campo `meta.drain`
  de PokeAPI es con signo: positivo drena, negativo es retroceso — se
  separa en dos hechos siempre no-negativos, verificado con Double-Edge
  `-33` → 33% retroceso y Giga Drain `50` → 50% drenaje), curación, ratio
  crítico, probabilidad de retraimiento, rango de golpes/turnos, cambios
  de stats con probabilidad, `past_values` (cambios históricos).
- **Flags de movimiento investigados, no construidos**: PokeAPI no los
  expone en absoluto (verificado contra Earthquake). Showdown sí los
  tiene pero integrarlos es una fuente de datos nueva; documentado como
  deuda, no forzado.

### feat: MT/MO/TR (`src/data/generated/machines.json`, `src/services/machines.ts`)
- `move.machines` solo da ids de máquina (hasta 25 por movimiento);
  resolverlas en caliente sería una cascada de peticiones. Generado
  offline desde PokeAPI `/machine` (2372 registros, ~63 KB) igual que el
  resto de catálogos — `scripts/generate-catalogs.ts --only=machines`,
  0 peticiones en runtime. Earthquake resuelve a MT26 en Rojo/Azul y
  juegos posteriores (dato real conocido, verificado).

### feat: efecto vs. flavor de habilidad (`src/utils/abilityFacts.ts`)
- Distingue explícitamente el efecto mecánico del flavor text de juego,
  con fallback honesto (efecto ES → efecto EN → flavor ES → flavor EN,
  siempre etiquetado). `effect_changes` como cambios históricos.
  Verificado: Rough Skin no tiene `effect_entries` en español — la
  página ES cae correctamente al efecto en inglés (etiquetado "Efecto"),
  no al flavor.

### refactor: `PokemonRelationList.astro`
- Sustituye `PokemonCard` en ambas páginas: sprite + nombre + enlace +
  detalle de relación (p. ej. "Oculta"), sin tier competitivo. Pese a
  subir el tope de 40 a 60, las páginas quedaron más ligeras: Earthquake
  456.6 → 259.6 KB HTML crudo (−43%), medido contra `develop` en un
  worktree aislado.

**Verificado en vivo (dev server real, PokeAPI real, ES y EN):**
Earthquake (MT26, sin ailment), Tackle (sin mecánicas notables), Body
Slam (Parálisis 30%), Double-Edge (Retroceso 33%), Giga Drain (Drenaje
50%), Fury Swipes (rango de golpes), Rough Skin (efecto en inglés en
página ES), Intimidate (cambios históricos reales), Levitate (45
Pokémon, sin necesidad de "Mostrando N").

**Deliberadamente descartado (documentado):** dataset de relación
Pokémon↔movimiento con método/nivel (requeriría un dataset offline del
orden de toda la base de learnsets, no construido esta fase); contest
data de movimientos.

---

## 2026-09-27 (Sesión 9 — Fase 2B: ficha Pokémon factual)

**Objetivo:** convertir `/[lang]/pokemon/[name]/` en una ficha enciclopédica
factual completa (entrenamiento, cría, clasificación, Pokédex regional) sin
añadir peticiones nuevas a PokeAPI ni tocar el scope competitivo. Rama
`feature/pokemon-entity-phase2b`, partiendo de `develop` tras mergear la
PR #14 (Game Context).

**Auditoría previa:** `species`/`detail` ya traían `capture_rate`,
`base_happiness`, `gender_rate`, `hatch_counter`, `growth_rate`,
`egg_groups`, `genera`, `pokedex_numbers`, `is_baby/legendary/mythical` y
`stats[].effort` — ninguno se leía. Cero peticiones nuevas necesarias.

**Cambios realizados:**

### feat(pokemon): capa factual (`src/utils/pokemonFacts.ts`)
- `buildPokemonFacts(detail, species)` puro, sin idioma: entrenamiento
  (experiencia base, ratio de captura, amistad base, ritmo de crecimiento,
  EVs desde `stats[].effort`), cría (grupos huevo, proporción de género,
  ciclos de huevo), clasificación (bebé/legendario/mítico), Pokédex
  regional.
- **Semántica de `gender_rate` verificada, no asumida**: es octavos que son
  hembra, no un porcentaje directo (-1 sin género, 0 = 100% macho, 8 = 100%
  hembra, 4 = 50/50). Degrada a "sin género" en vez de `NaN` si el valor
  falta.

### feat(pokemon): tabla de Pokédex (`src/services/pokedexes.ts`)
- Las 35 `pokedex` de PokeAPI, verificadas en vivo (nombres ES/EN reales,
  no inventados) con el flag propio `is_main_series` de PokeAPI —no
  patrones de nombre— para excluir `conquest-gallery` (Conquest, spin-off)
  y `champions` (dex de batalla de Pokémon Champions, ya clasificado
  `battle` en `gameContext.ts`). `original-*`/`updated-*` del mismo región
  se muestran ambas: son juegos reales distintos, no duplicados.

### refactor(pokemon): plantilla (`src/pages/[lang]/pokemon/[name].astro`)
- Nuevas secciones semánticas (`<dl>`) Entrenamiento/Cría junto a Números
  de Pokédex regional; badges Bebé/Legendario/Mítico junto al nombre;
  género (categoría, p. ej. "Pokémon Mach") bajo el nombre. Sin script
  cliente nuevo, sin JSON adicional al navegador.

**Verificado en vivo (dev server real, PokeAPI real):** Garchomp,
Pikachu, Eevee, Wormadam (muchas formas) muestran las tres secciones;
Zapdos → Legendario; Mew → Mítico; Pichu → Bebé; Ditto → Sin género;
Vulpix-Alola enlaza correctamente a su forma. ES y EN comprobados.

**Deliberadamente descartado (documentado en `pokemon-entity.md`):**
`color`/`shape`/`habitat` de la especie (sin tabla de traducción, bajo
valor); segunda línea "Evoluciona de X" (la cadena evolutiva ya lo
cubre); título/descripción SEO sin cambios (los nuevos datos son
profundidad complementaria, no una nueva intención de búsqueda).

---

## 2026-09-27 (Sesión 8 — Fase 2: base de Game Context)

**Objetivo:** construir la base de Game Context (juego/familia vs revisión
de datos PokeAPI) y aplicarla primero a los movimientos de la ficha
Pokémon, sin tocar todavía learnsets ampliados, localizaciones, Pokédex
regional ni páginas de juego. Rama `feature/game-context-phase2`, partiendo
de `develop` tras mergear la PR #13 (Fase 1 enciclopedia).

**Cambios realizados:**

### feat(game-context): modelo (`src/services/gameContext.ts`)
- `GameContextDefinition` agrupa version groups en familias de juego sobre
  la tabla `VERSION_GROUPS` existente (sin tocarla): Escarlata/Púrpura +
  Máscara Turquesa + Disco Índigo, Espada/Escudo + Isla de la Armadura +
  Nieves de la Corona, y Leyendas Z-A + Mega Dimensión se pliegan en un
  único contexto cada uno. Clasificación `main-series`/`spin-off`/`battle`.
  Resolución de contexto por defecto: el `main-series` más reciente
  disponible, con su revisión de datos más reciente dentro de ese contexto;
  spin-offs/battle nunca lo desplazan.
- **Investigación en vivo antes de decidir** (no asumido por nombre):
  `GET /version-group/the-indigo-disk` devuelve `move_learn_methods: []`, y
  ningún Pokémon comprobado (Ogerpon, Okidogi, Walking Wake,
  Ursaluna-Bloodmoon, Iron Crown, Wo-Chien, Garchomp, Pikachu) tiene ninguna
  DLC de Escarlata/Púrpura o Espada/Escudo en su `moves[].version_group_details`
  — solo la base. El plegado DLC→juego base es correcto y queda listo, pero
  hoy no se ejerce con datos reales de movimientos. Detalle completo:
  `docs/architecture/game-context.md`.

### refactor(moves): `MovesTable.astro` consume Game Context
- El selector lista un contexto por opción (p. ej. una sola "Escarlata /
  Púrpura"), no un version group crudo por opción. `data-context-revisions`
  lleva al cliente el mapa contexto→revisión ya resuelto por el servidor
  (sin re-derivar la tabla de DLC en el navegador). Sin petición extra a
  PokeAPI al cambiar de contexto (los datos ya viajan en el payload
  compacto existente).

### feat: persistencia (`src/utils/gameContextStorage.ts`)
- Un valor (`pokepedia_game_context`) en `localStorage`, mismo patrón que
  `favorites.ts`/`searchHistory.ts`. SSR renderiza el contexto por defecto
  del servidor; el cliente, tras hidratar, cambia al contexto persistido
  solo si el Pokémon actual tiene datos para él.

### feat(analytics)
- Evento `game_context_change` (contexto, idioma, superficie), a través de
  `trackEvent()` existente — sin texto libre ni PII.

**Verificado en vivo (AstroContainer + PokeAPI real, no solo tests
sintéticos):** Garchomp/Pikachu/Lucario abren en Escarlata/Púrpura
(Champions listado, no por defecto); Genesect/Zeraora (sin datos de
Escarlata/Púrpura) caen a Espada/Escudo; Ogerpon (solo Escarlata/Púrpura)
muestra una única opción.

**Aprendido:**
- La deuda de UX de Fase 1 sobre el Enter en la búsqueda de home (enlace
  oculto navegable) no se corrigió: cubrirla con un test aislado requeriría
  añadir jsdom/happy-dom como dependencia de test, lo que excede el scope
  de esta fase. Queda anotada en `TODO.md`.

---

## 2026-09-26 (Sesión 7 — Fase 1: enciclopedia de entidades)

**Objetivo:** corregir la versión por defecto de los movimientos, alinear Pokepedia con su papel (enciclopedia; estrategia → PokeStudio, tipos → PokeTypes), búsqueda global multi-entidad y capa de datos compacta para los índices. Rama `feature/encyclopedia-phase1`, 6 commits.

**Cambios realizados:**

### fix(moves): versión más reciente por defecto (`MovesTable.astro`, `services/versionGroups.ts`)
- `versionGroups` se ordenaba alfabéticamente y se abría en `x-y`. Ahora `VERSION_GROUPS` (orden, etiquetas ES/EN, `defaultEligible`) decide: se abre en el grupo principal más reciente (Garchomp → Escarlata/Púrpura); Champions, XD, Colosseum y DLC siguen en el selector pero no son defecto. "Último disponible" ≠ "contexto por defecto" (ver `docs/DATA_SOURCES.md`).

### refactor(product): copy alineado (`Layout`, `pokemon.ts`, `[name].astro`, `SmogonTier.astro`, `ecosystem.ts`)
- Fuera "análisis estratégico / calculadora / debilidades" de home, metadatos, JSON-LD, OG y página de Pokémon. `CompetitiveSets` → `SmogonTier` (solo tier atribuido, SSR, sin script). Se elimina la petición de sets de Smogon. `meta keywords` eliminado. CTA a PokeStudio detrás de `ecosystem.ts` (sin URL pública → no se renderiza).

### fix(home): grid y buscador coherentes (`utils/homeSearch.ts`)
- El texto solo filtra el grid si alguna tarjeta lo cumple; si no (movimiento, habilidad, tipo, Pokémon de otra generación) el desplegable multi-entidad lo gestiona y el grid no muestra "No se encontraron Pokémon".

### feat(data) + feat(search) + perf(catalogs)
- `npm run data:catalogs` genera catálogos ES/EN (movimientos, habilidades, objetos, Pokémon) y el índice de búsqueda; `--check` compara con PokeAPI. Búsqueda global multi-entidad con ranking determinista e historial multi-tipo. Índices `/movimientos/`, `/habilidades/`, `/objetos/` con los campos principales en SSR y 0 peticiones cliente.
- Detalle y métricas: `docs/audits/encyclopedia-phase1.md`.

**Aprendido:**
- Los tests dentro de `src/pages/` los empaqueta Astro como rutas (chunk `test.*.mjs` de 654 KB en el worker). Los nuevos van en `src/testing/` y `src/services/`; mover los existentes queda como deuda.
- `console.log` de Vitest no llega a la terminal en este repo: escribir a fichero para sondear.

---

## 2026-07-12 (Sesión 6 — hotfix MovesTable)

**Cambios realizados:**

### fix: JSON.parse falla en MovesTable (`src/components/MovesTable.astro`)
- Astro no evalúa expresiones `{...}` dentro de `<script>` tags (los trata como CDATA opaco).
- `<script type="application/json" id="moves-data">{JSON.stringify(movesByVersion)}</script>` llegaba al DOM como texto literal `{JSON.stringify(movesByVersion)}`.
- Fix: cambiado a `<div id="moves-data" hidden>{JSON.stringify(movesByVersion)}</div>`. Astro evalúa la expresión en elementos HTML normales; `textContent` decodifica las entidades HTML (`&quot;` → `"`) antes de pasárselas a `JSON.parse`.

---

## 2026-06-30 (Sesión 5 — features C6 + C8)

**Objetivos:** Implementar historial de búsqueda y sets competitivos de Smogon con i18n completo.

**Cambios realizados:**

### fix: título hero EN usaba "The Ultimate" en vez de "The Encyclopedia" (`src/utils/pokemon.ts`)
- Inconsistencia cosmética detectada al arrancar la sesión. Una línea de fix. Release `v0.5.2`.

### feat: C8 — Historial de búsqueda (`src/layouts/Layout.astro`, `src/pages/[lang]/pokemon/[name].astro`)
- Al visitar cualquier página de Pokémon, se guarda `{name, id, sprite}` en `pokepedia_history` (localStorage, máx 8, FIFO).
- Al abrir el modal de búsqueda global o cuando el input queda con < 2 chars, se renderiza el historial con sprites, IDs y badge "RECIENTE".
- Botón "Limpiar" borra el historial y refresca la vista.

### feat: C6 — Sets competitivos Smogon (`src/services/smogon.ts`, `src/components/CompetitiveSets.astro`)
- Nueva función `getSmogonSets(pokemonName, tier)` en `smogon.ts`. Descarga `https://pkmn.github.io/smogon/data/sets/{format}.json` (caché 24h en memoria). Mapea tier → formato Gen 9.
- Los sets (nombre, movimientos, objeto, habilidad, naturaleza) se renderizan SSR en `CompetitiveSets.astro` sin JS adicional en cliente.
- Falla silenciosamente si el CDN no responde.

### fix: i18n de sets competitivos (`src/services/pokeapi.ts`, `src/utils/pokemon.ts`)
- `getLocalizedNames(slugs, endpoint, lang)` en `pokeapi.ts` traduce moves e items via PokeAPI en paralelo, reutilizando la caché existente.
- Natures: mapa estático de 25 entradas en `pokemon.ts` (cero fetch extra).
- Abilities: reutiliza `abilitiesWithTranslation` ya fetcheado en la página.
- La traducción solo ocurre si `lang === 'es'`; en inglés los nombres quedan tal cual.

### Release v0.6.0
- Minor version bump (dos features nuevas).
- Rama `feature/search-history-smogon-moves` → `develop` → `main`.
- Tag `v0.6.0`.

**Decisiones:**
- Usamos `pkmn.github.io/smogon` en lugar de las chaos stats de Smogon (formato texto, archivos de 50MB+). Los archivos por tier son < 1MB.
- La traducción de moves/items se hace SSR en `[name].astro` para no añadir JS al cliente ni bloquear la hidratación.

---

## 2026-06-29 (Sesión 4 — hotfix)

**Objetivos:** Corregir dos bugs post-release detectados antes de dormir.

**Cambios realizados:**

### fix: middleware siempre redirigía a inglés (`src/middleware.ts`)
- `acceptLang.includes('en')` matcheaba cualquier header que contuviera la cadena `'en'`, incluyendo `es-ES,es;q=0.9,en-US;q=0.8,...`.
- Reemplazado por `parsePreferredLang()` que parsea los q-values correctamente y elige el idioma de mayor prioridad.

### fix: botón de idioma apuntaba a página errónea (`src/layouts/Layout.astro`)
- El header tiene `transition:persist`, lo que congela el `href` SSR del botón de idioma al primer page load.
- Navegar a `/es/pokemon/charizard` y volver al home dejaba el botón apuntando a `/en/pokemon/charizard`.
- Solución: `id="lang-switch-btn"` + `updateLangSwitch(lang)` en `initAll()` recalcula el href usando `window.location.pathname` en cada `astro:page-load`.

### fix: tipos no se traducían en el grid del index (`src/pages/[lang]/index.astro`)
- Las cards renderizaban `{typeName}` (slug crudo Smogon: `fire`, `water`...) en vez de `typeTranslations[lang][typeName]`.
- Una línea de fix.

### Release v0.5.1
- `package.json`: bump `0.5.0` → `0.5.1`.
- Merge `develop` → `main`.
- Tag anotado `v0.5.1`.

**Decisiones:**
- Hotfix directo en `develop` → `main` dado que todos los bugs afectaban al usuario en producción.
- `transition:persist` se mantiene en el header (evita flash); el href del lang switch se actualiza por JS en su lugar.

**Próximos pasos:**
- Elegir una feature de la Sección C del TODO.md para la siguiente sesión.
- Candidatos prioritarios: C8 (historial búsqueda, bajo coste) o C1 (type calculator inline).

---

## 2026-06-29 (Sesión 3)

**Objetivos:** Continuar mejoras UI/UX y cerrar release v0.5.0.

**Cambios realizados:**

### fix: bug click en cards (index.astro)
- `<a>` invisible subido de `z-0` a `z-10` — ahora cubre toda la card para clicks.
- Sprite wrapper, nombre `<p>` y tipos `<div>`: añadido `pointer-events-none` — clicks caen al `<a>` sin interceptarse.
- Header div (ID + fav): `pointer-events-none` en el contenedor, `pointer-events-auto` solo en el botón fav.
- `onclick` del fav button en SSR: añadido `event.preventDefault()`.
- Mismo fix aplicado en `createPokemonCard()` JS (cards de favoritos cargadas dinámicamente).

### Release v0.5.0
- `package.json`: bump `0.4.4` → `0.5.0`.
- Merge `feature/ui-ux-improvements` → `develop` → `main`.
- Tag anotado `v0.5.0` publicado en remoto con changelog completo.

**Decisiones:**
- La solución al bug de click fue `pointer-events-none` en decorativos + `<a z-10>` sobre ellos, en lugar de `pointer-events-none` en el `<a>` y gestionar clicks via JS (más frágil).
- Confirmado: no se eliminan ramas integradas (`feature/ui-ux-improvements` sigue en remoto).

**Próximos pasos:**
- Elegir una feature de la Sección C del TODO.md para la siguiente sesión.
- Candidatos prioritarios: C8 (historial búsqueda, bajo coste) o C1 (type calculator inline).

---

## 2026-06-28 (Sesión 2)

**Objetivos:** Frontend audit completo — corregir todos los bugs (A) y mejoras (B) identificadas por el agente frontend-developer. Rama: `feature/frontend-audit-fixes`.

**Cambios realizados:**

### src/utils/pokemon.ts
- Añadida función `escapeHtml()` exportable para uso SSR.
- Añadidas claves de traducción EN/ES: `navigation_unavailable`, `back_to_top`, `type_analysis`, `weaknesses`, `tier_legend`, `priority`, `pp`, `version`, `moves_col_level`, `moves_col_effect`, `view_on_poketypes`, `power`, `accuracy`.

### src/services/smogon.ts
- Añadida función `getSmogonDataBatch(names[])` — carga tipos + stats base de múltiples Pokémon en una sola petición al CDN de Showdown. Usa el mismo caché interno de `fetchWithCache`.

### src/middleware.ts
- Tipado corregido: `(context: any, next: any)` → `import type { APIContext, MiddlewareNext }`.

### src/components/TierLegend.astro
- "Leyenda de Categorías (Tiers)" hardcodeado → `{t.tier_legend}`.

### src/components/EvolutionChain.astro
- `!== null` → `!= null` en `relative_physical_stats` para no mostrar "Atk = Def" cuando el valor es `undefined`.

### src/components/CompetitiveSets.astro
- **Reescrito** con prop `showdownData?: { tier, abilities } | null`.
- Pasa tier y abilities via `data-ssr-*` attributes al script cliente — evita descarga del pokedex.json (multi-MB) en cliente.
- Guard `window._competitiveSetsInitialized` contra listeners duplicados.
- Todo `innerHTML` dinámico protegido con `escHtml()`.

### src/components/MovesTable.astro
- Moves data: `data-moves` attr → `<script type="application/json" id="moves-data">`.
- Race condition: `prefetchRequestId` counter para descartar respuestas stale.
- Todos los headers de columna: claves de traducción del objeto `t`.

### src/pages/[lang]/index.astro
- SSR: `getSmogonDataBatch` para pre-cargar tipos + stats en servidor — elimina N fetches cliente (B1).
- Cards: `<div>` + `<a class="absolute inset-0">` + `<button class="z-20">` — resuelve button-inside-a (B9).
- `createPokemonCard()` actualizado para coincidir con la nueva estructura SSR.
- `loadFavoritesView()`: `Promise.all` → `Promise.allSettled` (A8).
- Suggestions: DOM construction en lugar de `innerHTML` con datos de API (A1).
- Listeners `keydown`/`click` en `init()`: `AbortController` pattern (A5).
- `loadPokemonData()` eliminado — SSR ya provee los datos de tipos/stats.

### src/layouts/Layout.astro
- `window.onscroll` → `window.addEventListener('scroll', ..., { passive: true })` con cleanup (A5).
- `initGlobalSearch`: `AbortController` para rota listeners en cada `astro:page-load` (A5).
- Modal search results: DOM construction — elimina XSS (A1).
- Modal `#global-search-modal`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (B8).
- Focus trap via `keydown Tab` dentro del modal (B8).
- `#back-to-top`: `title` → `aria-label` localizado (B6).

### src/pages/[lang]/comparar/[p1]/[p2].astro
- Barras de stats: proporcionales (`s1/(s1+s2)*100`) en lugar de `s/255*100` (A3).
- Sección "Weaknesses": placeholder eliminado; reemplazado con badges de tipos + enlace a poketypes.app por cada Pokémon (A4).
- Labels `type_analysis` y `weaknesses`: claves de traducción (B5).

### src/pages/[lang]/pokemon/[name].astro
- `is_hidden` ability: `Object.entries` con key `'H'` (A7).
- Segundo `<h1>` del nombre del Pokémon → `<h2>` (A2).
- `seoTitle` y `seoDescription`: condicionales ES/EN (B4).
- `showdownData` accesible fuera del try block; pasado como prop a `CompetitiveSets` (B3).
- `width="40" height="40"` en imágenes prev/next nav (B10).

### src/pages/[lang]/movimientos/[name].astro
- Labels hardcodeados `Potencia`, `Precisión`, `Prioridad`, `PP` → `{t.power}`, `{t.accuracy}`, `{t.priority}`, `{t.pp}` (B5).

### src/pages/[lang]/habilidades/index.astro
- `escHtml()` añadida al script cliente.
- `div.innerHTML` de suggestions: `info.name` e `info.desc` protegidos con `escHtml()` (A1).

### src/pages/[lang]/movimientos/index.astro
- `escHtml()` añadida al script cliente.
- `div.innerHTML` de suggestions: `info.name` protegido con `escHtml()` (A1).

**Decisiones:**
- A4 resuelto con enlace a poketypes.app (propiedad del mismo developer) en lugar de un type chart inline. Doble objetivo: no duplicar funcionalidad + aumentar tráfico cruzado entre los dos sitios.
- `loadPokemonData()` eliminado (era la capa de N fetches cliente de tipos); SSR con Smogon batch lo reemplaza completamente.
- Features de sección C registradas como backlog en TODO.md para revisión futura.

**Próximos pasos:**
- Commit + merge de `feature/frontend-audit-fixes` → `develop`.
- Revisar poketypes.app con enfoque similar (audit + mejoras).
- Evaluar C7 (integración profunda entre ambas apps).

---

## 2026-06-28 (Sesión 1)

**Objetivos:** Configuración del entorno de colaboración con Claude Code.

**Cambios realizados:**
- Creado `CLAUDE.md` con arquitectura completa del proyecto (comandos, routing, servicios, componentes, restricciones Cloudflare).
- `CLAUDE.md` adaptado a la estructura de `AGENTS.md`: 8 secciones, Modo Ejecución Directa seleccionado, protocolos GitFlow y de sesión incluidos.
- Creados `TODO.md` y `BITACORA.md`.

**Decisiones:**
- Modo Ejecución Directa: Claude escribe el código de forma autónoma, sin modo tutor.
- `SPANISH_PATCHES` en `pokeapi.ts` es el punto de entrada canónico para traducciones ES faltantes.

**Próximos pasos:** Pendiente de instrucciones del usuario.
