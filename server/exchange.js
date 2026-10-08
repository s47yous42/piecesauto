// ECB reference rates: units of each currency for one euro, with the source date.
export function parseExchangeRates(xml) {
  const date = xml.match(/<Cube\s+time=['"]([0-9-]+)['"]/i)?.[1];
  if (!date || !Number.isFinite(Date.parse(date))) return null;
  const values = { EUR: 1 };
  for (const match of xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    const rate = Number(match[2]);
    if (rate > 0 && Number.isFinite(rate)) values[match[1]] = rate;
  }
  return { date, values };
}

export async function readExchangeRates({ fetchImpl = fetch, signal } = {}) {
  try {
    const response = await fetchImpl('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) return null;
    const xml = await response.text();
    return xml.length < 20000 ? parseExchangeRates(xml) : null;
  } catch { return null; }
}
