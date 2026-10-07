const searchOnSite = (domain, query) =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`;

const withCondition = (query, condition) => {
  if (condition === 'new') return `${query} neuf`;
  if (condition === 'used') return `${query} occasion`;
  return query;
};

export const suppliers = [
  {
    id: 'oscaro',
    name: 'Oscaro',
    description: 'Pièces neuves et équipementiers',
    category: 'Neuf',
    conditions: ['new'],
    color: 'orange',
    searchUrl: (query, condition) =>
      `https://www.oscaro.com/recherche?query=${encodeURIComponent(withCondition(query, condition))}`,
  },
  {
    id: 'autodoc',
    name: 'AUTODOC',
    description: 'Catalogue de pièces neuves',
    category: 'Neuf',
    conditions: ['new'],
    color: 'red',
    searchUrl: (query, condition) =>
      `https://www.auto-doc.fr/search?keyword=${encodeURIComponent(withCondition(query, condition))}`,
  },
  {
    id: 'ebay',
    name: 'eBay',
    description: 'Pièces neuves et d’occasion',
    category: 'Neuf & occasion',
    conditions: ['new', 'used'],
    color: 'blue',
    searchUrl: (query, condition) => {
      const params = new URLSearchParams({ _nkw: withCondition(query, condition) });
      if (condition === 'new') params.set('LH_ItemCondition', '1000');
      if (condition === 'used') params.set('LH_ItemCondition', '3000');
      return `https://www.ebay.fr/sch/i.html?${params.toString()}`;
    },
  },
  {
    id: 'francecasse',
    name: 'France Casse',
    description: 'Réseau de casses automobiles',
    category: 'Occasion',
    conditions: ['used'],
    color: 'green',
    searchUrl: (query, condition) =>
      searchOnSite('francecasse.fr', withCondition(query, condition)),
    searchVia: 'recherche web ciblée',
  },
  {
    id: 'leboncoin',
    name: 'Leboncoin',
    description: 'Annonces de particuliers et pros',
    category: 'Neuf & occasion',
    conditions: ['new', 'used'],
    color: 'yellow',
    searchUrl: (query, condition) =>
      `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(withCondition(query, condition))}`,
  },
  {
    id: 'opisto',
    name: 'Opisto',
    description: 'Pièces auto d’occasion garanties',
    category: 'Occasion',
    conditions: ['used'],
    color: 'teal',
    searchUrl: (query, condition) =>
      searchOnSite('opisto.fr', withCondition(query, condition)),
    searchVia: 'recherche web ciblée',
  },
  {
    id: 'gpa26',
    name: 'GPA 26',
    description: 'Pièces issues de véhicules recyclés',
    category: 'Occasion',
    conditions: ['used'],
    color: 'navy',
    searchUrl: (query, condition) =>
      searchOnSite('gpa26.com', withCondition(query, condition)),
    searchVia: 'recherche web ciblée',
  },
];

export const normalizeSearch = (value, type) => {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return type === 'oem' ? normalized.toUpperCase() : normalized;
};

export const buildSupplierUrl = (supplier, query, condition) =>
  supplier.searchUrl(query, condition);
