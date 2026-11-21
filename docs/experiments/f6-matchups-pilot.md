# F6 · Experimento 1 — Piloto de debilidades y resistencias en la ficha de Pokémon

Protocolo operativo del piloto. Diseño aprobado y evidencia:
[`docs/audits/f6-experiment-1-design-2026-11-21.md`](../audits/f6-experiment-1-design-2026-11-21.md).
Política de arquitectura: [`docs/DATA_SOURCES.md`](../DATA_SOURCES.md#type-matchups-reference-data-in-pokepedia-analysis-in-poketypes).

## 1. Qué cambia (solo en las 30 especies de tratamiento)

| Pieza | Dónde |
|---|---|
| Matriz estática 18×18, tabla moderna (Gen VI+) | `src/utils/typeMatchups.ts` |
| Asignación fija tratamiento/control | `src/utils/matchupPilot.ts` |
| Textos (resumen, título, descripción) ES/EN generados con datos | `src/utils/matchupCopy.ts` |
| Bloque SSR (H2, resumen, tabla ×4/×2/×½/×¼/×0, enlaces `/tipo/`, nota de alcance, enlace a PokeTypes) | `src/components/TypeMatchups.astro`, insertado en `src/pages/[lang]/pokemon/[name].astro` |
| Claves de interfaz ES/EN | `uiTranslations` en `src/utils/pokemon.ts` |

Tratamiento recibe: bloque + `<title>` + `meta description` (también reflejados en `og:`/`twitter:`). **Control y el resto de especies: HTML idéntico byte a byte** (test). No se tocan canonical, hreflang, sitemap, redirects, slugs, robots ni la configuración de indexación; no hay URLs nuevas; no hay peticiones nuevas (el cálculo es una tabla constante).

Alcance de las afirmaciones: solo tipos. Habilidades, objetos, Teracristalización y movimientos que cambian de tipo **no** se modelan y la página lo declara; el análisis especializado queda en PokeTypes.

### Asignación (fija; no se vuelve a sortear ni a redistribuir)

Sorteada una vez con semilla 20261121, dentro de parejas emparejadas por demanda histórica de debilidades (11.167 vs 11.170 impresiones).

- **Tratamiento (30):** corviknight, muk, lucario, slowbro, grimmsnarl, gyarados, shuckle, alakazam, scrafty, flygon, malamar, ursaluna, flamigo, yveltal, gliscor, hatterene, raichu, floette, aggron, regieleki, dragonite, falinks, nidoqueen, steelix, baxcalibur, skuntank, pinsir, abra, dragapult, scovillain.
- **Control (30):** archaludon, gardevoir, froslass, tyranitar, machamp, persian, hitmonlee, ludicolo, clefable, charizard, weavile, exeggutor, hydreigon, iron-hands, goodra, onix, haxorus, gengar, mightyena, tentacruel, electrode, mawile, golem, noivern, kadabra, blastoise, drampa, weezing, regirock, koffing.
- **Resto:** ≈ 965 especies sin cambios (referencia de deriva global).

Cada especie cubre 2 URLs (ES y EN): 60 URLs tratadas, 60 de control. Los tests (`src/utils/matchupCopy.test.ts`) fijan estas listas contra el diseño.

## 2. Calendario

| Hito | Fecha |
|---|---|
| Despliegue (T0) | **Pendiente.** No antes de confirmar que el *November 2026 Core Update* (iniciado 2026-11-10) ha terminado según el Google Search Status Dashboard. Se registrará aquí la fecha real. |
| Línea base | Instantánea de Search Console de los 28 días previos a T0 (solo lectura) y copia del HTML previo de las 120 URLs. |
| Primer rastreo estimado | T0 + 1 a 14 días. Objetivo: ≥ 80 % de las URLs tratadas revisitadas a T0 + 14 días. Se verifica con URL Inspection en T0 + 3, 7, 14 y 28 días. |
| Periodo de observación | T0 → T0 + 70 días (≈ 10 semanas). |
| Ventana de evaluación principal | Semanas 5–10 (T0 + 28 → T0 + 70 días). |
| Decisión | T0 + 70 días. |

Congelación: durante T0 − 14 d → T0 + 70 d no se despliega ningún otro cambio de plantilla de Pokémon, metadatos globales, sitemap, canonical, redirects ni navegación. Si el core update sigue desplegándose, se retrasa T0.

## 3. Métricas

Todas de solo lectura, por semana y por grupo (tratamiento / control / resto):

1. **Search Console (primaria):** impresiones de queries de debilidades (`debilidad|weakness|weak`) en las URLs de cada grupo.
2. Posición media ponderada por impresiones de esas queries; nº de queries distintas; nº de URLs con ≥ 1 impresión.
3. Impresiones y clics de todas las queries (efecto colateral; se espera estable) y clics de las de debilidades (descriptivo).
4. **URL Inspection:** indexada, última visita, canonical elegida por Google (120 URLs) en T0 + 3/7/14/28.
5. **GA4:** `cross_site_click` con `target=poketypes`, separado por `source_surface` (`pokemon_matchups` = enlace nuevo del bloque; `pokemon_detail` = chip superior ya existente), tratamiento frente a control.
6. **Salud:** respuestas 5xx y tamaño HTML en las 120 URLs; el Error 1101 sigue bajo vigilancia (incidencia conocida, no relacionada).

## 4. Criterios de interpretación (fijados antes del despliegue)

Línea base ≈ 0: se usan umbrales absolutos y comparación pareada, no variaciones relativas por URL.

- **Puerta 0 (≤ T0 + 14 d):** ≥ 80 % de URLs tratadas revisitadas; sin cambio de estado indexado ni de canonical elegida; sin aumento de 5xx.
- **Éxito mínimo (ventana semanas 5–10):** tratamiento ≥ 150 impresiones de debilidades acumuladas **y** ≥ 3 × control **y** tratamiento > control en ≥ 15 de las ≈ 20 parejas con datos (prueba de signos unilateral, p ≈ 0,02).
- **Éxito fuerte:** tratamiento ≥ 975 impresiones acumuladas (≈ 10 % del ritmo histórico del grupo, 233/día) y posición mediana ≤ 15.
- **Clics:** no son criterio de éxito (CTR histórico de esta intención 0,018 %); se reportan de forma descriptiva.
- **Tratamiento ≈ control ≈ 0 con Puerta 0 superada:** resultado **inconcluso, no fracaso**. La caída del 5 de mayo fue site-wide y puede limitar cualquier mejora a nivel de página. No se generaliza; se prolonga o se espera al siguiente core update. Un resultado sin volumen suficiente nunca se interpreta como refutación.
- **Tratamiento consistentemente peor que control:** revertir y reabrir el diagnóstico.
- **Éxito mínimo o fuerte:** se propone generalizar a todas las especies y formas en un único despliegue (retirando `matchupPilot.ts`).

Nota de ajuste respecto al diseño: el diseño fijaba umbrales sobre las semanas 5–8; al ampliar la observación a ≈ 10 semanas la ventana pasa a 6 semanas (5–10) y los umbrales absolutos se escalan ×1,5 (100 → 150; 650 → 975). La razón ≥ 3 × y el criterio de parejas no cambian.

## 5. Medición del incremento de HTML

Diferencia medida con la misma ficha con y sin experimento (fixtures deterministas): **+6,8 KB sin comprimir y +1,3 KB comprimido (gzip)** en Corviknight (ES y EN). Bloque aislado en las 30 especies × 2 idiomas: 3,9–7,0 KB (mediana 5,4 KB). La estimación del diseño ("+< 3 KB") se quedó corta en bytes sin comprimir (el bloque lleva 8–12 enlaces con atributos de seguimiento y una nota de alcance); el coste transferido sí es < 3 KB. Los tests acotan el incremento (< 8 KB sin comprimir, < 3 KB gzip).

## 6. Validación previa al despliegue

- Matriz: 324 interacciones elementales y 171 tipificaciones contra un snapshot independiente de PokeAPI (`src/utils/__fixtures__/types/type-chart.json`); 8 inmunidades; totales 51/61/8; casos dorados de uno y dos tipos.
- Textos ES/EN, título y descripción (≤ 160 caracteres para todas las tipificaciones), tipos reales de las 30 especies de tratamiento.
- SSR del componente: semántica y accesibilidad (sección etiquetada, tabla con `caption`, `th scope`, listas, sin salto de encabezados, texto además de color), enlaces a `/{lang}/tipo/{tipo}/` con barra final, enlace a PokeTypes seguro.
- SSR de la ficha: tratamiento con bloque y metadatos nuevos; control y no piloto idénticos byte a byte con el experimento activado y desactivado; sin peticiones adicionales; canonical y hreflang idénticos; la página tratada solo difiere de su base en el bloque, `<title>` y descripciones.

## 7. Reversión

Vaciar `MATCHUP_TREATMENT` en `src/utils/matchupPilot.ts` (o revertir el único commit) y redesplegar. Título, descripción y HTML vuelven al estado anterior en la siguiente visita de Google. No hay URLs, redirects, canonical, sitemap ni indexación que deshacer, y no hay nada que revertir en Search Console. Disparadores: dato incorrecto confirmado, aumento sostenido de 5xx en las tratadas, caída sostenida de visitas revisadas o decisión de producto.
