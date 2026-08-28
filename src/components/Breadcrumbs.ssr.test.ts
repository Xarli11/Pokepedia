import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Breadcrumbs from './Breadcrumbs.astro';
import { SITE_URL } from '../utils/seo';

describe('Breadcrumbs SSR', () => {
  it('renders a visible trail with links for every item except the last (current page)', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Breadcrumbs, {
      props: {
        items: [
          { label: 'Home', href: '/en/' },
          { label: 'Types', href: '/en/tipos/' },
          { label: 'Dragon' },
        ],
      },
    });

    expect(html).toContain('aria-label="breadcrumb"');
    expect(html).toContain('href="/en/"');
    expect(html).toContain('href="/en/tipos/"');
    expect(html).toContain('>Dragon<');
    expect(html).toContain('aria-current="page"');
  });

  it('emits a valid BreadcrumbList JSON-LD with absolute URLs and no url on the current page', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Breadcrumbs, {
      props: {
        items: [
          { label: 'Home', href: '/en/' },
          { label: 'Dragon' },
        ],
      },
    });

    const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(match).toBeTruthy();
    const jsonLd = JSON.parse(match![1]);

    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(jsonLd.itemListElement).toHaveLength(2);
    expect(jsonLd.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${SITE_URL}/en/`,
    });
    expect(jsonLd.itemListElement[1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      name: 'Dragon',
    });
  });
});
