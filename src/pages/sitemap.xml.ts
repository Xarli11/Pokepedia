import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const languages = ['es', 'en'];
  const siteUrl = 'https://pokepedia.app';
  const lastmod = new Date().toISOString().split('T')[0];

  let pokemon = [];
  let moves = [];
  let abilities = [];
  let items = [];

  try {
    // Obtener datos dinámicos de PokeAPI en paralelo con timeout y reintentos sutiles
    const [pokemonRes, movesRes, abilitiesRes, itemsRes] = await Promise.all([
      fetch('https://pokeapi.co/api/v2/pokemon?limit=1025').then(r => r.json()).catch(() => ({ results: [] })),
      fetch('https://pokeapi.co/api/v2/move?limit=1000').then(r => r.json()).catch(() => ({ results: [] })),
      fetch('https://pokeapi.co/api/v2/ability?limit=400').then(r => r.json()).catch(() => ({ results: [] })),
      fetch('https://pokeapi.co/api/v2/item?limit=500').then(r => r.json()).catch(() => ({ results: [] }))
    ]);

    pokemon = pokemonRes.results || [];
    moves = movesRes.results || [];
    abilities = abilitiesRes.results || [];
    items = itemsRes.results || [];
  } catch (e) {
    console.error('Sitemap generation error, falling back to static pages only');
  }

  // Páginas estáticas / Índices
  const staticPages = [
    { path: '/', priority: '1.0' },
    { path: '/movimientos/', priority: '0.9' },
    { path: '/habilidades/', priority: '0.9' },
    { path: '/objetos/', priority: '0.9' }
  ];

  const generateUrlEntry = (path: string, priority: string = '0.7', changefreq: string = 'weekly') => {
    // Asegurar que el path empiece y termine correctamente
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const finalPath = cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;

    return languages.map(lang => {
      const otherLang = lang === 'es' ? 'en' : 'es';
      const fullUrl = `${siteUrl}/${lang}${finalPath}`;
      const otherUrl = `${siteUrl}/${otherLang}${finalPath}`;
      const defaultUrl = `${siteUrl}/es${finalPath}`;
      
      return `
  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <xhtml:link rel="alternate" hreflang="${lang}" href="${fullUrl}"/>
    <xhtml:link rel="alternate" hreflang="${otherLang}" href="${otherUrl}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}"/>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    }).join('');
  };

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${staticPages.map(p => generateUrlEntry(p.path, p.priority)).join('')}
  ${pokemon.map((p: any) => generateUrlEntry(`/pokemon/${p.name}`, '0.8')).join('')}
  ${moves.map((m: any) => generateUrlEntry(`/movimientos/${m.name}`, '0.6')).join('')}
  ${abilities.map((a: any) => generateUrlEntry(`/habilidades/${a.name}`, '0.6')).join('')}
  ${items.map((i: any) => generateUrlEntry(`/objetos/${i.name}`, '0.5')).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'
    }
  });
};
