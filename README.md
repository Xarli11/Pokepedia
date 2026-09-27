# 🐉 Pokepedia Research Lab

**Pokepedia** es la enciclopedia Pokémon: Pokémon, movimientos, habilidades, objetos, evoluciones, formas, generaciones y datos de juego, conectados y fáciles de consultar. Forma parte de un ecosistema de tres productos: **Pokepedia** (conocimiento), **PokeTypes** (tipos: debilidades, resistencias, cobertura) y **PokeStudio** (equipos, sets, estrategia y cálculo). Bajo una estética de "Laboratorio de Investigación", ofrece una experiencia técnica, limpia y extremadamente fluida.

![Estado del Proyecto](https://img.shields.io/badge/ESTADO_DEX-ACTIVO-emerald?style=for-the-badge)
![Tecnología](https://img.shields.io/badge/CORE-ASTRO_SSR-slate?style=for-the-badge)

## 🧬 Filosofía del Proyecto
El objetivo principal de Pokepedia es democratizar el acceso a los datos técnicos de los 1025 Pokémon conocidos, eliminando el ruido visual de las wikis convencionales y priorizando la **precisión técnica** y la **velocidad de consulta**. Cada ficha responde en segundos: *¿Qué es? ¿Qué stats y habilidades tiene? ¿Qué movimientos aprende (en el juego más reciente por defecto)? ¿Cómo evoluciona? ¿En qué generación apareció?*

## 💎 Identidad Visual "Research Lab"
Hemos desarrollado una interfaz **Premium Dark** basada en una paleta de grises azulados (`slate`) y verdes esmeralda (`emerald`). 
*   **Logo Tecnológico**: Una identidad visual que evoca terminales de datos científicas.
*   **Visualización de Datos**: Uso de gráficos de radar SVG y barras de progreso semaforizadas para una lectura instantánea del potencial de cada especie.
*   **Minimalismo Funcional**: Cada elemento de la UI tiene un propósito técnico, desde los iconos de categorías hasta las etiquetas de prioridad en los movimientos.

## 🛰️ Módulos de Investigación

### 📋 Pokédex de Nueva Generación
Un buscador global multi-entidad (Pokémon —con Megas, Gigamax y variantes regionales—, movimientos, habilidades, objetos, tipos y generaciones) sobre un índice compacto por idioma, sin una petición por pulsación.

### 🏷️ Dato de referencia: tier de Smogon
Cada ficha muestra, atribuido y sin dominar la página, el tier de Smogon (datos públicos de Pokémon Showdown). Los sets y la estrategia competitiva viven en PokeStudio.

### 📦 Base de Datos de Objetos y Movimientos
*   **Objetos**: Clasificación inteligente por "Super-categorías" (Bayas, Medicinas, Combate) que agrupa los datos fragmentados de la API en filtros útiles para el usuario.
*   **Movimientos**: Tabla técnica con tipo, categoría, potencia, precisión, PP y prioridad, ya en el HTML del servidor.
*   **Catálogos generados**: `npm run data:catalogs` genera los datasets ES/EN (`src/data/generated/`) desde PokeAPI; ver `docs/DATA_SOURCES.md`.

### 🧬 Evolución Recursiva Avanzada
Un motor lógico capaz de renderizar cadenas evolutivas complejas, manejando múltiples ramificaciones (como Eevee) y condiciones especiales de evolución (objetos, niveles, etc.).

## 🛠️ Excelencia Técnica
*   **Renderizado Híbrido**: Uso de Astro SSR para una carga inicial instantánea y SEO perfecto, combinado con hidratación selectiva para búsquedas y filtros en tiempo real.
*   **Localización Profunda**: Soporte completo e inteligente para **Español e Inglés**, traduciendo descripciones, nombres de habilidades, categorías de objetos y metadatos técnicos.
*   **Optimización de Recursos**: Carga perezosa (Lazy Loading) de imágenes y datos para garantizar que la navegación sea fluida incluso en listas de más de mil objetos.

---

*Desarrollado con precisión técnica por **Xarli11** para la comunidad Pokémon.*
