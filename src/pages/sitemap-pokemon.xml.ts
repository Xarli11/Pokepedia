import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025');
  const data = await response.json();
  const pokemon = data.results;

  const languages = ['es', 'en'];
  const siteUrl = 'https://pokepedia.app';

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${pokemon.map((p: any) => {
    return languages.map(lang => {
      const otherLang = lang === 'es' ? 'en' : 'es';
      return `
  <url>
    <loc>${siteUrl}/${lang}/pokemon/${p.name}</loc>
    <xhtml:link rel="alternate" hreflang="${lang}" href="${siteUrl}/${lang}/pokemon/${p.name}"/>
    <xhtml:link rel="alternate" hreflang="${otherLang}" href="${siteUrl}/${otherLang}/pokemon/${p.name}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/es/pokemon/${p.name}"/>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }).join('');
  }).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'
    }
  });
};
