// Public search pages, without private endpoints or anti-bot workarounds.
export const marketplaces = [
  { id: 'leboncoin', name: 'Leboncoin', country: 'fr', domain: 'www.leboncoin.fr', path: (q) => `/recherche?text=${encodeURIComponent(q)}` },
  { id: 'kleinanzeigen', name: 'Kleinanzeigen', country: 'de', domain: 'www.kleinanzeigen.de', path: (q) => `/s-autoteile-reifen/${encodeURIComponent(q)}/k0c223` },
  { id: 'subito', name: 'Subito', country: 'it', domain: 'www.subito.it', path: (q) => `/annunci-italia/vendita/accessori-auto/?q=${encodeURIComponent(q)}` },
  { id: 'milanuncios', name: 'Milanuncios', country: 'es', domain: 'www.milanuncios.com', path: (q) => `/recambios-y-accesorios/?s=${encodeURIComponent(q)}` },
  { id: 'marktplaats', name: 'Marktplaats', country: 'nl', domain: 'www.marktplaats.nl', path: (q) => `/l/auto-onderdelen/q/${encodeURIComponent(q)}/` },
  { id: 'olx', name: 'OLX', country: 'pl', domain: 'www.olx.pl', path: (q) => `/motoryzacja/czesci-samochodowe/q-${encodeURIComponent(q)}/` },
  { id: 'willhaben', name: 'Willhaben', country: 'at', domain: 'www.willhaben.at', path: (q) => `/iad/kaufen-und-verkaufen/marktplatz/pkw-ersatzteile-zubehoer-6143?keyword=${encodeURIComponent(q)}` },
  { id: '2ememain', name: '2ememain', country: 'be', domain: 'www.2ememain.be', path: (q) => `/l/autos-pieces-accessoires/q/${encodeURIComponent(q)}/` },
];

export const marketplaceUrl = (marketplace, query) => `https://${marketplace.domain}${marketplace.path(query)}`;

export const partNames = [
  ['alternateur', 'lichtmaschine', 'alternatore', 'alternador', 'dynamo', 'alternator'],
  ['démarreur', 'anlasser', 'motorino avviamento', 'motor arranque', 'startmotor', 'rozrusznik'],
  ['rétroviseur', 'außenspiegel', 'specchietto', 'retrovisor', 'buitenspiegel', 'lusterko'],
  ['phare', 'scheinwerfer', 'faro', 'faro', 'koplamp', 'reflektor'],
  ['pare-chocs', 'stoßstange', 'paraurti', 'parachoques', 'bumper', 'zderzak'],
  ['injecteur', 'einspritzdüse', 'iniettore', 'inyector', 'injector', 'wtryskiwacz'],
  ['moteur', 'motor', 'motore', 'motor', 'motor', 'silnik'],
];

export function translateQuery(query, country) {
  const language = { fr: 0, be: 0, de: 1, at: 1, it: 2, es: 3, nl: 4, pl: 5 }[country];
  return partNames.reduce((text, names) => text.replace(new RegExp(names[0], 'gi'), names[language]), query);
}
