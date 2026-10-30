// JSON-LD builder that derives structured data from the rendered HTML,
// so the schema never claims something the page does not show.
// Pattern from module 07 (source: seo-optimizer.js). Zero dependencies.
// Demo: node build-json-ld.mjs

export function buildJsonLd({ html, title, url, siteUrl, siteName, author, destination, datePublished, dateModified }) {
  const schemas = [];
  const stripTags = (s) => s.replace(/<[^>]+>/g, '').trim();

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    author: author?.url
      ? { '@type': 'Person', name: author.name, url: author.url }   // a real, reachable person
      : { '@type': 'Organization', name: siteName, url: siteUrl },   // or the brand, honestly
    publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
    datePublished, dateModified: dateModified || datePublished,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  });

  // FAQPage only if the page really has extractable Q/A pairs.
  const faq = [];
  for (const m of html.matchAll(/<details[^>]*>\s*<summary>([\s\S]{10,300}?)<\/summary>\s*([\s\S]*?)<\/details>/gi)) {
    const q = stripTags(m[1]), a = stripTags(m[2]);
    if (a.length >= 20) faq.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });
  }
  for (const m of html.matchAll(/<h3[^>]*>([^<]{10,200}\?)<\/h3>\s*<p>([\s\S]{20,1000}?)<\/p>/gi)) {
    faq.push({ '@type': 'Question', name: m[1].trim(), acceptedAnswer: { '@type': 'Answer', text: stripTags(m[2]) } });
  }
  if (faq.length) schemas.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq });

  const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl }];
  if (destination) crumbs.push({ '@type': 'ListItem', position: 2, name: destination.name, item: destination.url });
  crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: title });
  schemas.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs });

  if (destination) {
    schemas.push({ '@context': 'https://schema.org', '@type': 'TouristDestination', name: destination.name, url: destination.url });
  }
  return schemas;
}

export const toScriptTags = (schemas) =>
  schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n');

// ---------- Demo ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const html = `<h2>FAQ</h2>
<details><summary>Do I need a visa for 14 days?</summary><p>Check the official embassy page before you book; rules change.</p></details>
<h3>How much is a hostel bed per night?</h3><p>Expect a range, and say where your numbers come from and when you checked them.</p>`;
  console.log(toScriptTags(buildJsonLd({
    html, title: 'Two weeks in Vietnam', url: 'https://example.com/vietnam-two-weeks/',
    siteUrl: 'https://example.com/', siteName: 'Example Travel', datePublished: '2026-01-15',
    destination: { name: 'Vietnam', url: 'https://example.com/destination/vietnam/' },
  })));
}
