import { useEffect, useState } from 'react';

const formatPrice = (price, currency = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(price);
const sourceLabels = { read: 'Consulté', blocked: 'Accès automatisé refusé', unreadable: 'Données non exploitables', unavailable: 'Indisponible' };

function OfferCard({ offer }) {
  return <article className="offer-card">
    <h4>{offer.title}</h4>
    <p><strong>{formatPrice(offer.price, offer.currency)}</strong> · {offer.condition === 'used' ? 'Occasion' : 'Neuf'} · {offer.source}</p>
    {offer.currency !== 'EUR' && offer.euroPrice !== null && <p>Environ {formatPrice(offer.euroPrice)} · change du {offer.exchangeDate}</p>}
    <p>{offer.totalEUR !== null ? `Total livré à 69390 : ${formatPrice(offer.totalEUR)}` : 'Livraison à 69390 non chiffrée ; total inconnu.'}</p>
    <p>{offer.match.label}</p>
    <a href={offer.url} target="_blank" rel="noopener noreferrer">Consulter l’annonce chez {offer.source} ↗</a>
  </article>;
}

export default function OfferComparison({ criteria, country, condition }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 55000);
    setLoading(true); setError(''); setData(null);
    fetch('./api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...criteria, country, condition }), signal: controller.signal })
      .then(async (response) => {
        let result;
        try { result = await response.json(); } catch { throw new Error('Le service de comparaison est indisponible. Les liens marchands restent utilisables.'); }
        if (!response.ok) throw new Error(result.error || 'Le service de comparaison est indisponible. Les liens marchands restent utilisables.');
        if (!Array.isArray(result.offers) || !result.best || !Array.isArray(result.sources)) throw new Error('Les offres reçues sont incomplètes.');
        if (active) setData(result);
      }).catch((reason) => { if (active) setError(reason.name === 'AbortError' ? 'La comparaison a dépassé le délai prévu. Réessayez.' : reason.message); })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [criteria, country, condition, refresh]);

  return <section className="offer-comparison" aria-labelledby="offers-heading">
    <div className="comparison-heading"><h3 id="offers-heading">Comparer occasion et neuf</h3><button type="button" onClick={() => setRefresh((v) => v + 1)} disabled={loading}>Actualiser les offres</button></div>
    <p>Livraison : Vernaison, 69390, France. Prix relevés dans les annonces accessibles ; frais de port séparés.</p>
    {!criteria.reference && <p>Ajoutez la référence OEM pour rapprocher l’occasion de son équivalent neuf. Une description seule ne confirme pas la compatibilité.</p>}
    {loading && <p role="status">Consultation des sites marchands…</p>}
    {error && <p role="status">{error}</p>}
    {data && <>
      <p>{data.sources.filter((s) => s.status === 'read').length} / {data.sources.length} sites consultés avec des données exploitables. {data.scope}</p>
      <div className="best-offers">{['used', 'new'].filter((kind) => condition === 'all' || condition === kind).map((kind) => <section key={kind} aria-label={kind === 'used' ? 'Meilleure offre occasion' : 'Meilleure offre neuve'}>
        <h4>{kind === 'used' ? 'Occasion' : 'Équivalent neuf'} · prix le plus bas relevé, hors port</h4>
        {data.best[kind] ? <OfferCard offer={data.best[kind]} /> : <p>Aucune offre avec la même référence OEM et un prix comparable n’a pu être retenue.</p>}
      </section>)}</div>
      <p>La présence de la référence dans l’annonce ne confirme pas le montage : vérifiez motorisation, dimensions, connecteurs et référence avec le vendeur.</p>
      <details><summary>{data.offers.length} offres correspondantes · détails et sources</summary>
        <div className="offer-list">{data.offers.map((offer) => <OfferCard key={offer.url} offer={offer} />)}</div>
        <ul className="source-status">{data.sources.map((source) => <li key={source.id}>{source.name} : {sourceLabels[source.status] || 'Indisponible'} ({source.count} annonces lues)</li>)}</ul>
        <p>Relevé : {new Date(data.checkedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}.</p>
      </details>
    </>}
  </section>;
}
