const searchOnSite = (domain, query) =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`;

const conditionTerms = {
  fr: { new: 'neuf', used: 'occasion' },
  de: { new: 'neu', used: 'gebraucht' },
  it: { new: 'nuovo', used: 'usato' },
  es: { new: 'nuevo', used: 'usado' },
};

const withCondition = (query, condition, country) =>
  condition === 'all' ? query : `${query} ${conditionTerms[country][condition]}`;

const ebaySupplier = (country, market, description) => ({
  id: `ebay-${country}`,
  name: 'eBay',
  description,
  category: 'Neuf & occasion',
  conditions: ['new', 'used'],
  country,
  countryLabel: market,
  color: 'blue',
  searchUrl: (query, condition) => {
    const params = new URLSearchParams({ _nkw: withCondition(query, condition, country) });
    if (condition === 'new') params.set('LH_ItemCondition', '1000');
    if (condition === 'used') params.set('LH_ItemCondition', '3000');
    return `https://www.ebay.${country}/sch/i.html?${params.toString()}`;
  },
});

export const countries = [
  { id: 'all', label: 'Toute l’Europe' },
  { id: 'fr', label: 'France' },
  { id: 'de', label: 'Allemagne' },
  { id: 'it', label: 'Italie' },
  { id: 'es', label: 'Espagne' },
];

export const suppliers = [
  {
    id: 'oscaro',
    name: 'Oscaro',
    description: 'Pièces neuves et équipementiers',
    category: 'Neuf',
    conditions: ['new'],
    country: 'fr',
    countryLabel: 'France',
    color: 'orange',
    searchUrl: (query, condition, country) =>
      `https://www.oscaro.com/recherche?query=${encodeURIComponent(withCondition(query, condition, country))}`,
  },
  {
    id: 'autodoc-fr',
    name: 'AUTODOC',
    description: 'Catalogue de pièces neuves',
    category: 'Neuf',
    conditions: ['new'],
    country: 'fr',
    countryLabel: 'France',
    color: 'red',
    searchUrl: (query, condition, country) =>
      `https://www.auto-doc.fr/search?keyword=${encodeURIComponent(withCondition(query, condition, country))}`,
  },
  ebaySupplier('fr', 'France', 'Annonces françaises, pièces neuves et d’occasion'),
  {
    id: 'francecasse',
    name: 'France Casse',
    description: 'Réseau de casses automobiles',
    category: 'Occasion',
    conditions: ['used'],
    country: 'fr',
    countryLabel: 'France',
    color: 'green',
    searchUrl: (query, condition, country) =>
      searchOnSite('francecasse.fr', withCondition(query, condition, country)),
    searchVia: 'recherche web ciblée',
  },
  {
    id: 'leboncoin',
    name: 'Leboncoin',
    description: 'Annonces de particuliers et pros',
    category: 'Neuf & occasion',
    conditions: ['new', 'used'],
    country: 'fr',
    countryLabel: 'France',
    color: 'yellow',
    searchUrl: (query, condition, country) =>
      `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(withCondition(query, condition, country))}`,
  },
  {
    id: 'opisto',
    name: 'Opisto',
    description: 'Pièces auto d’occasion garanties',
    category: 'Occasion',
    conditions: ['used'],
    country: 'fr',
    countryLabel: 'France',
    color: 'teal',
    searchUrl: (query, condition, country) =>
      searchOnSite('opisto.fr', withCondition(query, condition, country)),
    searchVia: 'recherche web ciblée',
  },
  {
    id: 'gpa26',
    name: 'GPA 26',
    description: 'Pièces issues de véhicules recyclés',
    category: 'Occasion',
    conditions: ['used'],
    country: 'fr',
    countryLabel: 'France',
    color: 'navy',
    searchUrl: (query, condition, country) =>
      searchOnSite('gpa26.com', withCondition(query, condition, country)),
    searchVia: 'recherche web ciblée',
  },
  {
    id: 'autodoc-de',
    name: 'AUTODOC',
    description: 'Pièces neuves avec catalogue allemand',
    category: 'Neuf',
    conditions: ['new'],
    country: 'de',
    countryLabel: 'Allemagne',
    color: 'red',
    searchUrl: (query, condition, country) =>
      `https://www.autodoc.de/search?keyword=${encodeURIComponent(withCondition(query, condition, country))}`,
  },
  {
    id: 'daparto',
    name: 'DAPARTO',
    description: 'Comparateur allemand de pièces auto',
    category: 'Neuf',
    conditions: ['new'],
    country: 'de',
    countryLabel: 'Allemagne',
    color: 'navy',
    searchUrl: (query, condition, country) =>
      searchOnSite('daparto.de', withCondition(query, condition, country)),
    searchVia: 'recherche web ciblée',
  },
  ebaySupplier('de', 'Allemagne', 'Annonces allemandes, pièces neuves et d’occasion'),
  {
    id: 'autodoc-it',
    name: 'AUTODOC',
    description: 'Pièces neuves avec catalogue italien',
    category: 'Neuf',
    conditions: ['new'],
    country: 'it',
    countryLabel: 'Italie',
    color: 'red',
    searchUrl: (query, condition, country) =>
      `https://www.auto-doc.it/search?keyword=${encodeURIComponent(withCondition(query, condition, country))}`,
  },
  {
    id: 'mister-auto-it',
    name: 'Mister-Auto',
    description: 'Pièces neuves et équipement automobile',
    category: 'Neuf',
    conditions: ['new'],
    country: 'it',
    countryLabel: 'Italie',
    color: 'teal',
    searchUrl: (query, condition, country) =>
      searchOnSite('mister-auto.it', withCondition(query, condition, country)),
    searchVia: 'recherche web ciblée',
  },
  ebaySupplier('it', 'Italie', 'Annonces italiennes, pièces neuves et d’occasion'),
  {
    id: 'autodoc-es',
    name: 'AUTODOC',
    description: 'Pièces neuves avec catalogue espagnol',
    category: 'Neuf',
    conditions: ['new'],
    country: 'es',
    countryLabel: 'Espagne',
    color: 'red',
    searchUrl: (query, condition, country) =>
      `https://www.auto-doc.es/search?keyword=${encodeURIComponent(withCondition(query, condition, country))}`,
  },
  {
    id: 'endado',
    name: 'Endado',
    description: 'Spécialiste espagnol de pièces auto',
    category: 'Neuf',
    conditions: ['new'],
    country: 'es',
    countryLabel: 'Espagne',
    color: 'green',
    searchUrl: (query, condition, country) =>
      searchOnSite('endado.com', withCondition(query, condition, country)),
    searchVia: 'recherche web ciblée',
  },
  ebaySupplier('es', 'Espagne', 'Annonces espagnoles, pièces neuves et d’occasion'),
];

export const normalizeSearch = (value, type) => {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return type === 'oem' ? normalized.toUpperCase() : normalized;
};

export const buildSupplierUrl = (supplier, query, condition) =>
  supplier.searchUrl(query, condition, supplier.country);
