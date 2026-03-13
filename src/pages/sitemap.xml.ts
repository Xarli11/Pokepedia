import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const siteUrl = 'https://pokepedia.app';
  const languages = ['es', 'en'];

  // Fetch all data in parallel
  const [pokemonRes, movesRes, abilitiesRes, itemsRes] = await Promise.all([
    fetch('https://pokeapi.co/api/v2/pokemon?limit=1025').then(res => res.json()),
    fetch('https://pokeapi.co/api/v2/move?limit=1000').then(res => res.json()),
    fetch('https://pokeapi.co/api/v2/ability?limit=500').then(res => res.json()),
    fetch('https://pokeapi.co/api/v2/item?limit=2100').then(res => res.json())
  ]);

  const pokemon = pokemonRes.results;
  const moves = movesRes.results;
  const abilities = abilitiesRes.results;
  const items = itemsRes.results.filter((i: any) => !i.name.includes('data-span'));

  const generateUrls = (items: any[], path: string, priority: string) => {
    return items.map((item: any) => {
      const name = item.name;
      return languages.map(lang => {
        const otherLang = lang === 'es' ? 'en' : 'es';
        const localizedPath = lang === 'es' 
          ? path.replace('moves', 'movimientos').replace('abilities', 'habilidades').replace('items', 'objetos')
          : path;
        const otherLocalizedPath = otherLang === 'es'
          ? path.replace('moves', 'movimientos').replace('abilities', 'habilidades').replace('items', 'objetos')
          : path;

        return `
  <url>
    <loc>${siteUrl}/${lang}/${localizedPath}/${name}</loc>
    <xhtml:link rel="alternate" hreflang="${lang}" href="${siteUrl}/${lang}/${localizedPath}/${name}"/>
    <xhtml:link rel="alternate" hreflang="${otherLang}" href="${siteUrl}/${otherLang}/${otherLocalizedPath}/${name}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/es/${localizedPath}/${name}"/>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
      }).join('');
    }).join('');
  };

  const staticRoutes = [
    { es: '', en: '', priority: '1.0' },
    { es: 'movimientos', en: 'moves', priority: '0.9' },
    { es: 'habilidades', en: 'abilities', priority: '0.9' },
    { es: 'objetos', en: 'items', priority: '0.9' }
  ];

  const staticUrls = staticRoutes.map(route => {
    return languages.map(lang => {
      const otherLang = lang === 'es' ? 'en' : 'es';
      const path = route[lang as 'es' | 'en'];
      const otherPath = route[otherLang as 'es' | 'en'];
      return `
  <url>
    <loc>${siteUrl}/${lang}${path ? '/' + path : ''}</loc>
    <xhtml:link rel="alternate" hreflang="${lang}" href="${siteUrl}/${lang}${path ? '/' + path : ''}"/>
    <xhtml:link rel="alternate" hreflang="${otherLang}" href="${siteUrl}/${otherLang}${otherPath ? '/' + otherPath : ''}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/es${route.es ? '/' + route.es : ''}"/>
    <changefreq>daily</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
    }).join('');
  }).join('');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${staticUrls}
  ${generateUrls(pokemon, 'pokemon', '0.8')}
  ${generateUrls(moves, 'moves', '0.6')}
  ${generateUrls(abilities, 'abilities', '0.6')}
  ${generateUrls(items, 'items', '0.5')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'
    }
  });
};
