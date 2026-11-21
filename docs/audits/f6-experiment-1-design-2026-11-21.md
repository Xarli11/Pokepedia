# F6 · Experimento 1 — Respuesta directa de debilidades en la ficha de Pokémon

> **Estado:** aprobado con ajustes. Implementación y protocolo operativo en [`docs/experiments/f6-matchups-pilot.md`](../experiments/f6-matchups-pilot.md). Desviaciones declaradas allí: incremento de HTML (+6,8 KB sin comprimir / +1,3 KB gzip frente a la estimación de < 3 KB), ventana de evaluación semanas 5–10 con umbrales escalados ×1,5, y resumen que lista hasta 5 tipos antes de agrupar por recuento.

Propuesta de diseño. **Nada implementado**: sin rama, commit, PR, Cloudflare ni escritura en Search Console. Código auditado: `origin/main` = `1e67e21` (v0.15.0) y producción (assets idénticos a v0.15.0).

## 1. La propuesta en una frase

Añadir a la ficha de Pokémon un bloque SSR **"Debilidades y resistencias de {Pokémon}"** calculado a partir de sus tipos (×4 / ×2 / ×½ / ×¼ / ×0), con una frase de respuesta directa y enlaces a las páginas `/tipo/`; reflejar esa respuesta en `<title>` y `meta description`; y enlazar a PokeTypes para lo que PokeTypes sí posee (habilidades, Teracristalización, cobertura). Piloto: 30 especies tratadas + 30 de control emparejadas, ES y EN (120 URLs existentes; **0 URLs nuevas**).

## 2. Evidencia (Search Console, no intuición)

Periodo 2026-03-14 → 05-04 (el de mayor visibilidad), consultas con `debilidad|weakness|weak`:

| Dato | Valor |
|---|---|
| Impresiones de esas queries aterrizando en `/pokemon/` | **71.590** (65.475 en especies base, 6.115 en formas) |
| Queries distintas | ~5.500; la plantilla "X debilidades" = 59 % |
| Idioma de la página que recibía | ES 57.030 impr · EN 14.600 impr (≈ 80 / 20) |
| Posición | ponderada 15,1; 26.834 impr en pos 4–10, 33.932 en 11–20 |
| Clics | **13** (CTR 0,018 %; el CTR global del sitio era 0,15 %) |
| Concentración | 985 especies con demanda; top 30 = 22 %, top 60 = 34 %, top 200 = 65 % |
| Ejemplos | `corviknight debilidades` 586 impr pos 9,3 · `archaludon debilidades` 463 pos 10,4 · `lucario debilidades` 372 pos 11,1 |

Lectura honesta de la evidencia:
- **Es la mayor bolsa de demanda** del sitio y la ficha **no contiene ninguna respuesta**: en v0.15.0 no hay multiplicadores, resistencias ni inmunidades en ninguna página (ni en `/tipo/`, que solo lista Pokémon). Solo existe un enlace "Debilidades en PokeTypes".
- **Pero es la intención con peor CTR**: 8× por debajo de la media. Es compatible con respuesta directa en el propio SERP (zero-click). **No debe esperarse tráfico proporcional a las impresiones.** El valor del experimento es recuperar relevancia/visibilidad para la intención dominante y medir si Google vuelve a considerar estas páginas, no cosechar clics.
- En el estado del 5/05 la página **tampoco contenía multiplicadores**: rankeaba en ~pos 10 con el título "…: Stats, **Debilidades** y Estrategia" y la descripción "…tipos, **debilidades** y estrategias competitivas". La release v0.7.0 (2026-08-27) los quitó ("Stats, Movimientos y Habilidades"). Hoy no hay ni título ni contenido que casen con la intención. (Correlación, no causalidad.)
- Otras intenciones por clics históricos (misma exportación): nombre de entidad solo ~46k impr / 67 clics; estrategia/competitivo 3,9k impr / 33 clics (CTR 0,85 %, intención PokeStudio); formas (mega/gmax) 5,6k impr / 23 clics. Ninguna iguala el volumen de debilidades.
- PokeTypes hoy no sirve esta intención: su enlace profundo (`?t1=steel&t2=flying&p=corviknight`) devuelve una app JS con canonical `https://poketypes.app/` y texto genérico ("Select a type or Pokemon to begin analysis"). En GSC de PokeTypes (90 d) 89 de 94 clics son la marca "poketypes"; rankea para "calculadora de tipos" (pos 3–5) y no para debilidades por Pokémon. **Ningún activo del ecosistema ofrece hoy la respuesta estática indexable.**

## 3. Auditoría de la plantilla de Pokémon (v0.15.0, `src/pages/[lang]/pokemon/[name].astro`)

| Pregunta factual | Hoy | Veredicto |
|---|---|---|
| ¿De qué tipo es? | Chips con enlace a `/{lang}/tipo/{type}/` | Resuelta |
| **¿Qué debilidades tiene? (×2/×4)** | Ninguna | **No resuelta — hueco principal** |
| **¿Qué resiste? (×½/×¼)** | Ninguna | **No resuelta** |
| **¿A qué es inmune? (×0)** | Ninguna | **No resuelta** |
| ¿Cómo cambian esas relaciones sus habilidades (Levitación, Absorbe Agua…)? | No | Hueco; candidato a v2 (lista curada) |
| Habilidades (normal/oculta) | Sí, con texto y enlace a `/habilidades/` | Resuelta |
| Estadísticas base y total | Sí | Resuelta (rangos Nv.50/100: sin demanda en GSC) |
| Evolución | Cadena con método y nivel | Resuelta |
| Movimientos | Tabla SSR con contexto de juego (52 enlaces a `/movimientos/` en Corviknight); nombres de movimiento en inglés en página ES | Resuelta en datos; defecto de idioma anotado, fuera de alcance |
| Entrenamiento / cría / Pokédex | Sí | Resuelta |
| Tier competitivo | Sí, solo como referencia (política de `DATA_SOURCES.md`) | Resuelta |
| Relaciones: → habilidades, → movimientos, → tipos, → generación | Sí | Resueltas |
| Relación → objetos | No | Hueco menor, sin evidencia de demanda |

Observaciones de estructura (no se tocan en F6-1): `h1` + segundo `h2` con el mismo nombre; secciones principales como `h3` (el `h1` salta a `h3`).

## 4. Qué va en Pokepedia y qué se enlaza

| Información | Destino |
|---|---|
| Multiplicadores por tipos de la ficha (×4, ×2, ×½, ×¼, ×0) y su frase de respuesta | **Pokepedia** (hecho de referencia derivado de los tipos) |
| Calculadora interactiva, 3 tipos, Teracristalización, efecto de habilidades/objetos, cobertura ofensiva, comparar equipos | **PokeTypes** (enlace contextual dentro del bloque) |
| Sets, estrategia, equipos, optimización, cálculo de daño | **PokeStudio** (sin cambios: `POKESTUDIO_BASE_URL` es `null` por política; no se añaden enlaces) |

⚠ **Decisión requerida.** `docs/DATA_SOURCES.md` dice que PokeTypes "owns weaknesses, resistances, immunities, multipliers, coverage" y que Pokepedia solo enlaza. La propuesta no añade calculadora ni iframe, pero sí muestra la tabla base. Hay que aprobar explícitamente (y actualizar ese documento) que **Pokepedia expone la matriz base como hecho de referencia y PokeTypes conserva toda la herramienta**.

## 5. El cambio, exacto

**Bloque** (solo SSR, sin JS, dentro de la columna principal, tras "Estadísticas base"):
- `h2`: ES "Debilidades y resistencias de {Nombre}" · EN "{Name} weaknesses and resistances".
- Frase generada con datos, sin relleno. Ejemplo ES (Corviknight): *"Corviknight (Acero/Volador) recibe daño ×2 de Fuego y Eléctrico. Resiste Bicho y Planta (×¼) y otros 6 tipos (×½), y es inmune a Tierra y Veneno."*
- Tabla semántica (`<table>` con `<caption>`): filas solo para los multiplicadores que existan (×4, ×2, ×½, ×¼, ×0); cada tipo es un enlace a `/{lang}/tipo/{type}/` (reutiliza `pagePath` y `typeTranslations`). No hay fila ×1.
- Nota: "Relaciones por tipo (generación IX). No incluyen habilidades, objetos ni Teracristalización." + enlace existente `buildPokeTypesUrl(...)` con texto "Calcula con habilidades y Teracristalización en PokeTypes". Se mantiene `data-track-event="cross_site_click"`.

**Metadatos (solo piloto tratado)**:
- Título ES: `{Nombre}: Debilidades, Stats y Movimientos | Pokepedia.app` · EN: `{Name} Weaknesses, Stats & Moves | Pokepedia.app`.
- Descripción ES: *"Corviknight (Acero/Volador): débil a Fuego y Eléctrico (×2), inmune a Tierra y Veneno. Stats base (495), habilidades, evolución y movimientos."* (datos, ≤160 caracteres; recorte determinista si excede).

**Datos**: tabla estática 18×18 (generación IX), nueva `src/utils/typeMatchups.ts` con `matchupsFor(types)`; sin red, sin I/O nuevo (no añade peticiones a PokeAPI ni estado compartido). Cada forma usa sus propios `detail.types`. Si algún tipo no está en la tabla, el bloque no se renderiza.

**Archivos**: `src/utils/typeMatchups.ts` (+ test), `src/pages/[lang]/pokemon/[name].astro`, claves nuevas en `uiTranslations` de `src/utils/pokemon.ts` (ES y EN), una constante temporal con la lista del piloto, y `docs/DATA_SOURCES.md`. **No se toca**: canonical, hreflang, sitemap, redirects, slugs, robots/noindex, middleware, rutas.

**Valores esperados (verificados contra PokeAPI `type/*`, 120 de 324 celdas no neutras)**:

| Pokémon | ×4 | ×2 | ×½ | ×¼ | ×0 |
|---|---|---|---|---|---|
| Corviknight (Acero/Volador) | — | Fuego, Eléctrico | Normal, Volador, Psíquico, Dragón, Acero, Hada | Bicho, Planta | Tierra, Veneno |
| Gardevoir (Psíquico/Hada) | — | Fantasma, Veneno, Acero | Psíquico | Lucha | Dragón |
| Muk (Veneno) | — | Tierra, Psíquico | Bicho, Hada, Lucha, Planta, Veneno | — | — |
| Gyarados (Agua/Volador) | Eléctrico | Roca | Bicho, Lucha, Fuego, Acero, Agua | — | Tierra |
| Lucario (Lucha/Acero) | — | Lucha, Fuego, Tierra | Siniestro, Dragón, Planta, Hielo, Normal, Acero | Bicho, Roca | Veneno |

## 6. Entidades afectadas (piloto)

Universo: 60 especies base con más impresiones históricas de debilidades (ES+EN; 34 % de la demanda de especies). Emparejadas por rango y asignadas al azar dentro de cada pareja (semilla 20261121):

- **Tratamiento (30 → 60 URLs)**: corviknight, muk, lucario, slowbro, grimmsnarl, gyarados, shuckle, alakazam, scrafty, flygon, malamar, ursaluna, flamigo, yveltal, gliscor, hatterene, raichu, floette, aggron, regieleki, dragonite, falinks, nidoqueen, steelix, baxcalibur, skuntank, pinsir, abra, dragapult, scovillain.
- **Control (30 → 60 URLs, sin cambios)**: archaludon, gardevoir, froslass, tyranitar, machamp, persian, hitmonlee, ludicolo, clefable, charizard, weavile, exeggutor, hydreigon, iron-hands, goodra, onix, haxorus, gengar, mightyena, tentacruel, electrode, mawile, golem, noivern, kadabra, blastoise, drampa, weezing, regirock, koffing.
- **Equilibrio**: demanda histórica de debilidades 11.167 (T) vs 11.170 (C); mezcla de tipos comparable. Impresiones actuales (90 d, todas las queries): T 57 / C 43.
- **Resto (≈965 especies, sin cambios)**: referencia de deriva global.
- Formas (mega, gmax, regionales) fuera del piloto: heredarían el bloque automáticamente al generalizar.

## 7. Problema del usuario que resuelve

Quien busca "Corviknight debilidades" quiere un dato exacto y verificable (qué le hace ×2, qué no le afecta). Hoy la ficha le obliga a salir a otra herramienta para obtenerlo. Con el cambio lo ve sin salir, con enlaces a los tipos implicados, y si necesita ir más lejos (habilidades, Tera, cobertura) tiene el salto directo a PokeTypes, que es el producto diseñado para eso.

## 8. Experimento

**Hipótesis (H1)**: dar la respuesta de debilidades en HTML inicial, con título/descripción coherentes, hará que las URLs tratadas recuperen impresiones y posición para queries de debilidades antes y más que sus controles emparejados.
**H0**: sin diferencia entre tratadas y control.

**Diseño**: emparejado, aleatorizado, ES+EN, una sola variación de plantilla, un único despliegue en T0. **Es un paquete** (bloque + título + descripción): atribuye el efecto del conjunto, no de cada pieza.

**Congelación**: durante T0−14 d → T0+56 d no se despliega ningún otro cambio de plantilla de Pokémon, metadatos globales, sitemap, canonical, redirects ni navegación. Condición de inicio: el November Core Update (inició 2026-11-10) ha terminado según el Search Status Dashboard; si no, esperar.

**Métricas (Search Console, solo lectura, semanales; agrupadas por T / C / Resto)**:
1. Impresiones de queries de debilidades (regex `debilidad|weakness|weak`) — **primaria**.
2. Posición media ponderada de esas queries; nº de queries distintas; nº de URLs con ≥1 impresión.
3. Impresiones y clics de todas las queries (control de efecto colateral; se espera estable).
4. URL Inspection en D+3, D+7, D+14, D+28 sobre las 120 URLs (indexada, última visita, canonical elegida).
5. GA4 `cross_site_click` → PokeTypes en T vs C (secundaria, ecosistema).
6. Salud: respuestas 5xx y tamaño HTML en las 120 URLs.

**Línea base (a congelar en T0)**: esperada ≈ 0 (en 28 d el sitio entero tiene solo unas pocas impresiones de queries de debilidades). Con esa base **no se pueden usar variaciones relativas por URL**: se usan umbrales absolutos y comparación pareada.

**Criterios de éxito (pre-registrados, evaluar en semanas 5–8)**:
- *Puerta 0 (≤ D+14)*: ≥ 80 % de las URLs tratadas revisitadas tras T0; ningún cambio de estado indexado/canonical; 0 aumento de 5xx; HTML +< 3 KB.
- *Éxito mínimo*: T ≥ 100 impresiones de debilidades acumuladas **y** T ≥ 3 × C **y** T > C en ≥ 15 de las ≈ 20 parejas con datos (p ≈ 0,02, prueba de signos unilateral).
- *Éxito fuerte*: T ≥ 650 impresiones (≈ 10 % del ritmo histórico del grupo, 233/día × 28 d ≈ 6.500) **y** posición mediana ≤ 15.
- Los clics **no** son criterio (a CTR histórico 0,018 %, 650 impresiones ≈ 0 clics); se reportan de forma descriptiva.

**Resultados posibles y decisión**:
- Éxito mínimo o fuerte → generalizar a las demás especies y formas en un despliegue único (quitar la constante del piloto).
- T ≈ C ≈ 0 con Puerta 0 superada → **inconcluso, no refutación**: el estado del sitio (la caída es site-wide) puede bloquear cualquier mejora de página. No generalizar; prolongar a la semana 12 o tras el siguiente core update.
- T < C de forma consistente → revertir y reabrir el diagnóstico.

Realismo: el sitio tiene hoy ~1.100 impresiones en 90 días en todas las fichas; la probabilidad de un resultado inconcluso es alta por diseño, no por el cambio.

## 9. Riesgos

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Técnico (SSR estático, sin I/O ni estado nuevo; no afecta al 1101) | Bajo | Sin red; +~1,5–2 KB por página; vigilancia de 5xx |
| Exactitud de datos (tabla errónea = pérdida de confianza) | Bajo-medio | Test de paridad con fixture de PokeAPI (324 celdas); 5 resultados dorados; 171 combinaciones con invariantes (×0 solo desde inmunidad; múltiplos de ¼) |
| Alcance de la afirmación ("débil a…" sin habilidades) | Bajo | Nota explícita bajo la tabla + enlace a PokeTypes |
| SEO (título con "Debilidades" cambia CTR/pos.) | Bajo | Solo 60 URLs; reversible |
| Producto/ecosistema (choca con `DATA_SOURCES.md`) | Medio | Aprobación explícita y actualización del documento |
| Medición (volumen ≈ 0 → inconcluso) | Medio-alto | Umbrales absolutos pre-registrados; extender a 12 semanas |
| Confusión con otros eventos (core update, 1101) | Medio | Congelación; control emparejado; excluir semanas de despliegue de updates |

## 10. Reversión

- Vaciar la lista del piloto (o revertir el único commit) y redesplegar: las páginas vuelven a título/descripción/HTML previos; Google lo recoge en la siguiente visita.
- No hay URLs, redirects, canonical, sitemap ni indexación que deshacer; nada que revertir en Search Console.
- Guardar el HTML previo de las 120 URLs (fetch) antes de T0 para comparar.
- Disparadores: ≥ 1 dato incorrecto confirmado; aumento sostenido de 5xx en tratadas; caída de visitas revisadas; decisión de producto.

## 11. Pruebas previas al despliegue

- Unitarias (`vitest`): paridad de la tabla con fixture de `type/*` de PokeAPI; golden de Corviknight, Gardevoir, Muk, Gyarados, Lucario; invariantes de doble tipo; manejo de tipos desconocidos (no renderiza).
- SSR (`*.ssr.test.ts`): `h2`, frase y filas ES/EN; enlaces a `/es|en/tipo/*/`; enlace PokeTypes; no aparece en especies fuera del piloto; canonical/hreflang/robots idénticos.
- Diff de HTML en 3 URLs tratadas y 1 de control: solo cambian bloque, `<title>` y `meta description`.
- Revisión manual de 10 especies contra una fuente externa independiente.

## 12. Qué no se hace

No se crean URLs; no se tocan canonical, hreflang, sitemap, redirects, slugs ni indexación; no se corrige a ciegas el 1101; no se cambia el idioma de movimientos/habilidades ES ni la jerarquía de encabezados en este experimento (anotado para después).
