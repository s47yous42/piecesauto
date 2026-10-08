import { normalizeCondition } from '../src/offers.js';

export function readDocuments(html) {
  const documents = [];
  const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scripts)) {
    if (!/application\/ld\+json|__NEXT_DATA__/i.test(match[1])) continue;
    try { documents.push(JSON.parse(match[2])); } catch { /* Malformed data is never a price. */ }
  }
  return documents;
}

function safeUrl(value, source) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value, `https://${source.domain}`);
    return url.protocol === 'https:' && url.hostname === source.domain && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function extractOffers(html, source, observedAt = new Date().toISOString()) {
  const documents = readDocuments(html);
  const offers = [];
  let recognized = false;
  function add(value) {
    const url = safeUrl(value.url, source);
    if (!url || !value.title || !Number.isFinite(value.price) || value.price <= 0) return;
    offers.push({ ...value, url, source: source.name, sourceId: source.id, country: source.country, observedAt });
  }
  function walk(node, product = null) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((v) => walk(v, product)); return; }
    const types = [].concat(node['@type'] || []);
    if (types.includes('Product')) product = node;
    // Search-result metadata describes the query, not each nested listing.
    if (types.includes('AggregateOffer')) product = null;
    if (types.includes('Offer') && node.price !== undefined) {
      recognized = true;
      // AggregateOffer.lowPrice alone cannot identify a part, state or seller.
      add({ title: node.name || product?.name, description: node.description || product?.description || '', reference: product?.mpn || '', url: node.url || product?.url,
        price: typeof node.price === 'number' ? node.price : /^\d+(\.\d+)?$/.test(node.price) ? Number(node.price) : NaN,
        currency: node.priceCurrency, condition: normalizeCondition(node.itemCondition || product?.itemCondition),
        available: node.availability ? /\/(InStock|LimitedAvailability)$/.test(node.availability) : null,
        seller: node.seller?.name || '', shipping: null });
    }
    for (const [key, value] of Object.entries(node)) if (!['props', 'review', 'aggregateRating', 'isRelatedTo'].includes(key)) walk(value, product);
  }
  for (const doc of documents) {
    walk(doc);
    const props = doc.props?.pageProps;
    const results = props?.searchRequestAndResponse;
    if (Array.isArray(results?.listings) && results.hasErrors !== true) {
      recognized = true;
      for (const item of results.listings) {
        if (item.reserved || item.priceInfo?.priceType !== 'FIXED') continue;
        const attributes = [...(item.attributes || []), ...(item.extendedAttributes || [])];
        add({ title: item.title, description: item.categorySpecificDescription || item.description || '', url: item.vipUrl,
          price: Number.isFinite(item.priceInfo?.priceCents) ? item.priceInfo.priceCents / 100 : NaN, currency: 'EUR', condition: normalizeCondition(attributes.find((a) => a.key === 'condition')?.value),
          available: null, seller: item.sellerInformation?.sellerName || '', shipping: null });
      }
    }
    const willhaben = props?.searchResult?.advertSummaryList?.advertSummary;
    if (Array.isArray(willhaben)) {
      recognized = true;
      for (const item of willhaben) {
        if (item.advertStatus?.id !== 'active') continue;
        const attributes = Object.fromEntries((item.attributes?.attribute || []).map((a) => [a.name, a.values?.[0]]));
        add({ title: attributes.HEADING || item.description, description: attributes.BODY_DYN || '', url: attributes.SEO_URL ? `/iad/${attributes.SEO_URL}` : null,
          price: attributes['PRICE/AMOUNT'] ? Number(attributes['PRICE/AMOUNT']) : NaN, currency: 'EUR', condition: normalizeCondition(attributes.CONDITION), available: null, seller: attributes.ORGNAME || '', shipping: null });
      }
    }
  }
  const unique = [...new Map(offers.map((o) => [o.url, o])).values()];
  return { offers: unique, recognized };
}

export async function fetchPublicPage(url, { fetchImpl = fetch, signal } = {}) {
  const origin = new URL(url).origin;
  let response;
  for (let redirects = 0; redirects <= 3; redirects++) {
    response = await fetchImpl(url, { signal, redirect: 'manual', headers: { 'User-Agent': 'PieceAuto/1.0 (public price comparison)', Accept: 'text/html' } });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    if (!location || redirects === 3) return { status: 'unavailable', offers: [] };
    const destination = new URL(location, url);
    if (destination.origin !== origin || destination.username || destination.password) return { status: 'unavailable', offers: [] };
    await response.body?.cancel();
    url = destination.href;
  }
  if ([401, 403, 429].includes(response.status)) return { status: 'blocked', offers: [] };
  if (!response.ok) return { status: 'unavailable', offers: [] };
  // Refuse large pages and prevent fetch from following a merchant-controlled redirect.
  if (Number(response.headers.get('content-length')) > 5_000_000) return { status: 'unavailable', offers: [] };
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 5_000_000) { await response.body.cancel?.().catch(() => {}); return { status: 'unavailable', offers: [] }; }
    chunks.push(Buffer.from(chunk));
  }
  const html = Buffer.concat(chunks).toString('utf8');
  if (/id=["']captcha|captcha-delivery\.com|Access Denied|verify you are human|aws-waf-token/i.test(html)) return { status: 'blocked', offers: [] };
  return { html };
}
