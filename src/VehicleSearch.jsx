import { useEffect, useState } from 'react';
import { countries } from './suppliersConfig.js';
import { vehicleSources, vehicleEnergies, emptyVehicleFilters, prepareVehicleSearch, buildVehicleLink, loadVehicleExchange } from './vehicleSearch.js';

export default function VehicleSearch({ active = true }) {
  const [filters, setFilters] = useState(emptyVehicleFilters);
  const [criteria, setCriteria] = useState(null);
  const [country, setCountry] = useState('all');
  const [error, setError] = useState('');
  const [exchange, setExchange] = useState(null);
  const [exchangeStatus, setExchangeStatus] = useState('');
  const sources = vehicleSources.filter((source) => country === 'all' || source.country === country);
  const needsExchange = active && criteria && (criteria.priceMin !== null || criteria.priceMax !== null) && (country === 'all' || country === 'pl');

  useEffect(() => {
    setExchange(null); setExchangeStatus('');
    if (!needsExchange) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 7000);
    setExchangeStatus('Conversion du budget en zlotys pour la Pologne…');
    loadVehicleExchange({ signal: controller.signal }).then((value) => {
      if (active) { setExchange(value); setExchangeStatus(''); }
    }).catch(() => { if (active) setExchangeStatus('Conversion EUR/PLN indisponible : appliquez le budget en zlotys sur OLX. Les autres filtres restent disponibles.'); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [needsExchange, criteria]);

  const update = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setCriteria(null); setError('');
  };
  const submit = (event) => {
    event.preventDefault();
    const result = prepareVehicleSearch(filters);
    setError(result.error || ''); setCriteria(result.criteria || null);
  };

  if (!active) return null;
  return <div className="vehicle-search">
    <p className="vehicle-intro">Recherchez une voiture complète dans les annonces européennes. Décrivez la marque, le modèle et la version, puis précisez vos critères.</p>
    <form onSubmit={submit} noValidate>
      <label htmlFor="vehicle-description">Marque, modèle ou descriptif du véhicule</label>
      <div className="input-row">
        <span className="input-icon" aria-hidden="true">⌕</span>
        <input id="vehicle-description" value={filters.description} onChange={(event) => update('description', event.target.value)} placeholder="Ex. Mercedes 230 CE, Renault Clio hybride…" maxLength={180} />
        <button className="search-button" type="submit">Rechercher les véhicules <span aria-hidden="true">↗</span></button>
      </div>
      <div className="vehicle-filter-grid">
        <label htmlFor="vehicle-energy">Motorisation / énergie
          <select id="vehicle-energy" value={filters.energy} onChange={(event) => update('energy', event.target.value)}>
            {vehicleEnergies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        {[
          ['yearMin', 'Année à partir de', '2015'], ['yearMax', 'Année jusqu’à', '2022'],
          ['kmMin', 'Kilométrage minimum (km)', '0'], ['kmMax', 'Kilométrage maximum (km)', '100000'],
          ['priceMin', 'Prix minimum (€)', '5000'], ['priceMax', 'Prix maximum (€)', '15000'],
        ].map(([key, label, placeholder]) => <label key={key} htmlFor={`vehicle-${key}`}>{label}
          <input id={`vehicle-${key}`} inputMode="numeric" value={filters[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} />
        </label>)}
      </div>
      <p className="input-hint">Les critères sont facultatifs. Pour une année précise, indiquez la même année dans les deux champs.</p>
    </form>
    {error && <p className="error-message" role="alert">{error}</p>}
    <section className="results-section" aria-labelledby="vehicle-results-heading">
      <div className="results-heading"><div><p className="eyebrow">ANNONCES AUTOMOBILES</p><h2 id="vehicle-results-heading">Trouvez votre prochain véhicule<span>.</span></h2></div></div>
      <div className="country-filter" role="group" aria-label="Pays des annonces de véhicules">
        {countries.map((item) => <button key={item.id} type="button" className={country === item.id ? 'selected' : ''} aria-pressed={country === item.id} onClick={() => setCountry(item.id)}>{item.label}</button>)}
      </div>
      <p className="price-note">Les liens ouvrent les annonces de voitures, avec les filtres préremplis disponibles sur chaque site. Les critères à compléter chez le vendeur sont indiqués sur sa carte. Le budget est saisi en euros.</p>
      {!criteria ? <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌕</span><p>Décrivez le véhicule et lancez la recherche pour ouvrir les annonces dans les pays sélectionnés.</p></div> : <>
        <div className="query-summary"><span>Véhicules recherchés</span><strong>{criteria.description}</strong><span className="query-count">{sources.length} sites d’annonces</span></div>
        <div className="vehicle-criteria" aria-label="Critères de recherche des véhicules">
          {criteria.energy !== 'all' && <span>{vehicleEnergies.find((item) => item.id === criteria.energy).label}</span>}
          {(criteria.yearMin !== null || criteria.yearMax !== null) && <span>Année : {criteria.yearMin ?? 'sans minimum'} — {criteria.yearMax ?? 'sans maximum'}</span>}
          {(criteria.kmMin !== null || criteria.kmMax !== null) && <span>Km : {criteria.kmMin ?? '0'} — {criteria.kmMax ?? 'sans maximum'}</span>}
          {(criteria.priceMin !== null || criteria.priceMax !== null) && <span>Prix : {criteria.priceMin ?? '0'} — {criteria.priceMax ?? 'sans maximum'} €</span>}
        </div>
        {exchangeStatus && <p className="price-note" role="status">{exchangeStatus}</p>}
        <div className="supplier-grid vehicle-source-grid">
          {sources.map((source, index) => {
            const link = buildVehicleLink(source, criteria, exchange);
            return <article className="supplier-card vehicle-source-card" key={source.id}>
              <div className="card-topline"><span className={`supplier-logo ${source.color}`}>{source.name}</span><span className="card-index">{String(index + 1).padStart(2, '0')}</span></div>
              <span className="country-pill">{countries.find((item) => item.id === source.country).label}</span>
              <span className="category-pill">Voitures complètes</span>
              {link.applied.length > 0 && <p className="vehicle-filter-note">Filtres préremplis : {link.applied.join(', ')}.</p>}
              {link.manual.length > 0 && <p className="vehicle-filter-note manual-filters">À compléter sur le site : {link.manual.join(', ')}.{link.manual.includes('motorisation') && ' Énergie ajoutée au descriptif quand possible.'}</p>}
              {link.exchange && <p className="vehicle-filter-note">Budget converti en PLN, taux BCE du {link.exchange.date} : 1 € ≈ {link.exchange.rate} PLN.</p>}
              <a className="supplier-link vehicle-link" href={link.href} target="_blank" rel="noopener noreferrer">Voir les véhicules sur {source.name} <span aria-hidden="true">↗</span></a>
            </article>;
          })}
        </div>
      </>}
    </section>
  </div>;
}
