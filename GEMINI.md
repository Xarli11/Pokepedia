# Seguimiento del Proyecto: Pokepedia 🐉

## 📝 Estado Actual
Enciclopedia Pokémon de alto nivel con integración competitiva (Smogon/Showdown), soporte multi-idioma (ES/EN) y una interfaz premium optimizada para modo oscuro.

## ✅ Tareas Completadas
- [x] **Arquitectura**: Astro SSR con adaptador de Node para escalabilidad infinita.
- [x] **Diseño**: Tema "Verde Esmeralda" con Modo Oscuro Premium (Gris Azulado `slate-800/900`).
- [x] **Buscador Global**: Sugerencias en tiempo real para las 1025 especies (filtrando variantes estéticas).
- [x] **Pokedex**: Detalle con stats coloreadas (Semáforo), habilidades traducidas y evolución recursiva avanzada (maneja casos como Eevee o Inkay).
- [x] **Sección de Movimientos**: Tabla técnica con filtros, Prioridad, Categorías visuales (Físico/Especial/Estado) y búsqueda en español.
- [x] **Sección de Habilidades**: Índice limpio (sin CAP/Dummy) con traducciones profundas y descripciones con fallback.
- [x] **Sección de Objetos**: Listado con sprites, categorías, costes y Pokémon que los portan.
- [x] **Integración Competitiva**: Tiers oficiales de Smogon en tarjetas y Análisis de Meta detallado en la ficha técnica.
- [x] **UX**: Interruptor de tema tipo "Pill" animado con iconos SVG vectoriales.
- [x] **Contenido Avanzado**: Soporte para formas Mega, Gigamax y variantes regionales.
- [x] **Pokémon Aleatorio**: Botón de dados premium con animación.
- [x] **Gráficos de Radar**: Visualización SVG de estadísticas base.

## ⚙️ Normas de Trabajo y GitFlow
- **Commits**: Usar siempre **Conventional Commits** (feat, fix, docs, style, refactor, perf, test, chore).
- **Flujo de Trabajo (GitFlow)**:
    1. Crear rama `feature/[nombre]` desde `develop`.
    2. Probar cambios localmente.
    3. Tras confirmación del usuario, mergear a `develop`.
    4. Crear rama `release/[versión]` desde `develop`.
    5. Mergear `release` a `main`.
    6. Generar **Tag de Release** en `main`.

## 🛠️ Tareas en Proceso (Sesión Actual)
- [x] Refinamiento de metadatos técnicos en movimientos (Prioridad y Categorías).
- [x] Sincronización de traducciones en secciones competitivas.
- [x] Sistema de sugerencias visuales en todos los buscadores.
- [x] Guía de localización técnica con nombres oficiales traducidos.

## 🚀 Próximos Pasos
- [ ] Implementar sistema de "Favoritos" con LocalStorage.
- [ ] Comparador técnico entre dos Pokémon.
