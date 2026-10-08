import { useEffect, useMemo, useState } from 'react';
import { buildSupplierUrl, countries, suppliers } from './suppliersConfig.js';
import { inspectPlate, prepareSearch } from './search.js';
import VinDecoder from './VinDecoder.jsx';
import OfferComparison from './OfferComparison.jsx';
import { createOfferCriteria } from './offers.js';
import { identifyVinProfile } from './vinProfiles.js';
import VehicleSearch from './VehicleSearch.jsx';

// The comparison service is available only in the explicit local build.
const comparisonEnabled = import.meta.env.MODE === 'comparison';

const searchTypes = [
  { id: 'oem', label: 'Référence ou description', icon: '⌕' },
  { id: 'plate', label: 'Immatriculation', icon: '▤' },
  { id: 'vin', label: 'N° VIN', icon: '⌗' },
  { id: 'model', label: 'Modèle / année', icon: '🚘' },
  { id: 'vehicles', label: 'Véhicules', icon: '🚗' },
];

const conditions = [
  { id: 'all', label: 'Tous' },
  { id: 'new', label: 'Neuf' },
  { id: 'used', label: 'Occasion' },
];

function App() {
  const [searchType, setSearchType] = useState('oem');
  const [condition, setCondition] = useState('all');
  const [country, setCountry] = useState('all');
  const [inputs, setInputs] = useState({ oem: '', plate: '', vin: '', model: '', year: '' });
  const input = inputs[searchType] || '';
  const setInput = (value) => setInputs((previous) => ({ ...previous, [searchType]: value }));
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [submittedType, setSubmittedType] = useState('oem');
  const [vinDetails, setVinDetails] = useState(null);
  const [vehicles, setVehicles] = useState({ plate: '', vin: '' });
  const vinProfile = identifyVinProfile(inputs.vin);
  const vinVehicle = vehicles.vin || vinProfile?.description || '';
  const vehicle = searchType === 'vin' ? vinVehicle : vehicles[searchType] || '';
  const setVehicle = (value) => setVehicles((previous) => ({ ...previous, [searchType]: value }));
  // One requested part is shared by description, VIN, plate and model modes.
  const part = inputs.oem;
  const setPart = (value) => setInputs((previous) => ({ ...previous, oem: value }));
  const [reference, setReference] = useState('');
  const [offerCriteria, setOfferCriteria] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [image, setImage] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [imageStatus, setImageStatus] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.preview);
    },
    [image],
  );

  const visibleSuppliers = useMemo(
    () =>
      suppliers.filter(
        (supplier) =>
          (condition === 'all' || supplier.conditions.includes(condition)) &&
          (country === 'all' || supplier.country === country),
      ),
    [condition, country],
  );

  const submitSearch = (event) => {
    event.preventDefault();
    const prepared = prepareSearch({ type: searchType, input, vehicle, part, year: inputs.year || '', vinContext: { vin: inputs.vin, vehicle: vinVehicle } });
    setVinDetails(searchType === 'vin' && prepared.vin ? prepared : null);
    setCopyStatus('');
    if (prepared.error) {
      setError(prepared.error);
      setSubmittedSearch('');
      return;
    }
    setSubmittedSearch(prepared.query);
    if (comparisonEnabled) setOfferCriteria(createOfferCriteria({ query: prepared.query, type: searchType, vehicle: prepared.vehicle || '', part: prepared.part || input, reference }));
    setError('');
    setSubmittedType(searchType);
  };

  const copyVin = async () => {
    try {
      await navigator.clipboard.writeText(vinDetails.vin);
      setCopyStatus('VIN copié : transmettez-le au vendeur pour confirmer la référence compatible.');
    } catch {
      setCopyStatus('Copie indisponible : sélectionnez le VIN affiché et copiez-le manuellement.');
    }
  };

  const copyPlate = async () => {
    const details = inspectPlate(input);
    if (details.error) { setError(details.error); return; }
    try {
      await navigator.clipboard.writeText(details.plate);
      setCopyStatus('Plaque copiée. Collez-la dans le formulaire d’identification Oscaro.');
    } catch {
      setCopyStatus(`Copie indisponible : copiez manuellement ${details.plate}.`);
    }
  };

  const selectImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choisissez un fichier image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('L’image doit faire moins de 10 Mo.');
      return;
    }
    setError('');
    setImage({ file, preview: URL.createObjectURL(file) });
    setImageStatus('');
  };

  const analyzeImage = async () => {
    if (!image) {
      setError('Ajoutez une photo de la pièce à identifier.');
      return;
    }
    if (!apiKey.trim()) {
      setError('Saisissez votre clé API Gemini pour analyser la photo.');
      return;
    }

    setError('');
    setIsAnalyzing(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
        reader.readAsDataURL(image.file);
      });
      const [mimeType, encodedImage] = dataUrl.split(',');
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey.trim(),
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Identifie la pièce automobile visible. Réponds uniquement par un nom de pièce court et descriptif, en français. Si tu ne peux pas l’identifier, dis-le.',
                  },
                  {
                    inline_data: {
                      mime_type: mimeType.match(/data:(.*);base64/)[1],
                      data: encodedImage,
                    },
                  },
                ],
              },
            ],
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || `Erreur API (${response.status}).`);
      }
      const description = result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter(Boolean)
        .join(' ')
        .trim();
      if (!description) throw new Error('L’API n’a pas retourné de description exploitable.');

      setInputs((previous) => ({ ...previous, oem: description }));
      setSearchType('oem');
      setImageStatus(`Pièce reconnue : ${description}`);
      setSubmittedSearch('');
    } catch (caughtError) {
      setError(caughtError.message || 'Échec de l’analyse de la photo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="PieceAuto, accueil">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>piece<span>auto</span></span>
        </a>
        <span className="topbar-note"><span className="status-dot" /> Recherche multi-marchands</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span /> LE BONNE PIÈCE, SANS PERDRE DE TEMPS</p>
          <h1>La pièce qu’il vous faut.<br /><span>Au bon endroit.</span></h1>
          <p className="hero-description">
            Une recherche, plusieurs marchands. Comparez les pièces neuves et d’occasion en quelques clics.
          </p>
          <div className="trust-line">
            <span aria-hidden="true">↗</span> Pas de compte. Pas de détour. Vous choisissez où acheter.
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-circle circle-back" />
          <div className="art-circle circle-front" />
          <div className="part-card">
            <span className="part-card-tag">PIÈCE DU JOUR</span>
            <svg viewBox="0 0 230 140" role="img" aria-label="">
              <path d="M44 83 55 48q4-12 18-16l38-10q12-3 22 5l31 24 23 7q8 3 10 12l3 19q1 8-7 10l-13 2q-2-19-21-19t-21 20l-55 1q-2-21-21-21T41 104l-13-1q-8-1-6-10l3-9q2-6 9-7z" fill="#d9e2d1" stroke="#254633" strokeWidth="3" strokeLinejoin="round" />
              <path d="m63 49 10-12 37-9-3 30H57zm56 9 1-31q11-2 17 4l29 23z" fill="#f7f8f2" stroke="#254633" strokeWidth="3" strokeLinejoin="round" />
              <circle cx="63" cy="103" r="13" fill="#f8f8f1" stroke="#254633" strokeWidth="4" />
              <circle cx="181" cy="103" r="13" fill="#f8f8f1" stroke="#254633" strokeWidth="4" />
              <path d="m35 83 16 1m140-19 7 3" stroke="#254633" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <div className="part-card-footer"><span>En route pour trouver votre pièce</span><span>↗</span></div>
          </div>
          <span className="floating-spark spark-one">✳</span>
          <span className="floating-spark spark-two">✳</span>
          <div className="floating-label">{suppliers.length} marchands<br /><strong>en un clic</strong></div>
        </div>
      </section>

      <section className="search-panel" aria-labelledby="search-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">VOTRE RECHERCHE</p>
            <h2 id="search-heading">Qu’est-ce qu’on cherche ?</h2>
          </div>
          <span className="step-number">01 <span>/ 02</span></span>
        </div>

        <div className={`search-layout ${searchType === 'vehicles' ? 'vehicle-layout' : ''}`}>
          <div className="search-main">
            <div className="search-tabs" role="tablist" aria-label="Type de recherche">
              {searchTypes.map((type) => (
                <button
                  className={`search-tab ${searchType === type.id ? 'active' : ''}`}
                  key={type.id}
                  onClick={() => { setSearchType(type.id); setSubmittedSearch(''); setVinDetails(null); setError(''); setCopyStatus(''); }}
                  role="tab"
                  aria-selected={searchType === type.id}
                  type="button"
                >
                  <span aria-hidden="true">{type.icon}</span>{type.label}
                </button>
              ))}
            </div>
            <VehicleSearch active={searchType === 'vehicles'} />
            {searchType !== 'vehicles' && <>
            {inputs.vin.trim() && (searchType === 'oem' || searchType === 'vin') && (
              <div className="vin-help" aria-label="Véhicule associé à la recherche">
                <strong>Véhicule ciblé : {vinVehicle || 'à identifier dans l’onglet N° VIN'}</strong>
                <p>Le VIN et la description sont associés : les liens recherchent la pièce avec le modèle et la motorisation du véhicule, sans transmettre le VIN aux marchands.</p>
                {vinProfile && <p>Type constructeur {vinProfile.chassis} ; moteur d’origine {vinProfile.engine}, à vérifier sur le véhicule. <a href={vinProfile.source.url} target="_blank" rel="noopener noreferrer">Source : catalogue Motorservice ↗</a></p>}
                <button type="button" onClick={() => { setInputs((previous) => ({ ...previous, vin: '' })); setVehicles((previous) => ({ ...previous, vin: '' })); setSubmittedSearch(''); setVinDetails(null); setError(''); setCopyStatus(''); }}>Retirer le véhicule associé</button>
              </div>
            )}
            <form onSubmit={submitSearch}>
              <label className="sr-only" htmlFor="part-search">
                {searchType === 'vin'
                  ? 'Numéro VIN du véhicule'
                  : searchType === 'plate'
                    ? 'Immatriculation du véhicule'
                    : searchType === 'model'
                      ? 'Marque et modèle du véhicule'
                      : 'Référence OEM ou description'}
              </label>
              <div className="input-row">
                <span className="input-icon" aria-hidden="true">⌕</span>
                <input
                  id="part-search"
                  value={input}
                  onChange={(event) => { setInput(event.target.value); setSubmittedSearch(''); setVinDetails(null); setCopyStatus(''); setError(''); if (searchType === 'plate' || searchType === 'vin') setVehicle(''); }}
                  autoCapitalize={searchType === 'vin' ? 'characters' : 'none'}
                  spellCheck={false}
                  placeholder={
                    searchType === 'vin'
                      ? 'Ex. WVWZZZ1JZXW000001'
                      : searchType === 'plate'
                        ? 'Ex. AB-123-CD'
                        : searchType === 'model'
                          ? 'Ex. Renault Clio IV'
                          : 'Ex. 8200 123 456 ou alternateur Clio 4'
                  }
                />
                <button className="search-button" type="submit">
                  Trouver ma pièce <span aria-hidden="true">↗</span>
                </button>
              </div>
              {searchType === 'vin' && (
                <VinDecoder vin={input} onVehicle={(description) => { setVehicle(description); setSubmittedSearch(''); setError(''); }} />
              )}
              {searchType === 'plate' && (
                <div className="vin-decoder">
                  <strong>Identifier le véhicule avec la plaque</strong>
                  <p>Pour une plaque française, utilisez le formulaire d’immatriculation Oscaro, puis reportez le modèle et la motorisation ici. L’identification par plaque se fait chez le marchand.</p>
                  <button type="button" onClick={copyPlate}>Copier la plaque</button>{' '}
                  <a href="https://www.oscaro.com/" target="_blank" rel="noopener noreferrer">Identifier chez Oscaro ↗</a>
                  {copyStatus && <p role="status">{copyStatus}</p>}
                </div>
              )}
              {searchType === 'model' && (
                <div className="vin-fields model-fields">
                  <label htmlFor="model-year">Année du véhicule
                    <input
                      id="model-year"
                      inputMode="numeric"
                      maxLength={4}
                      value={inputs.year || ''}
                      onChange={(event) => {
                        setInputs((previous) => ({ ...previous, year: event.target.value }));
                        setSubmittedSearch('');
                        setError('');
                      }}
                      placeholder="Ex. 2016"
                    />
                  </label>
                  <label htmlFor="model-part">Pièce ou référence OEM
                    <input id="model-part" value={part} onChange={(event) => { setPart(event.target.value); setSubmittedSearch(''); }} placeholder="Ex. alternateur ou référence constructeur" />
                  </label>
                </div>
              )}
              {searchType !== 'oem' && searchType !== 'model' && (
                <div className="vin-fields">
                  <label htmlFor="vin-vehicle">Modèle et motorisation
                    <input id="vin-vehicle" value={vehicle} onChange={(event) => { setVehicle(event.target.value); setSubmittedSearch(''); }} placeholder="Ex. Renault Clio IV 1.5 dCi 90, 2016" />
                  </label>
                  <label htmlFor="vin-part">Pièce ou référence OEM
                    <input id="vin-part" value={part} onChange={(event) => { setPart(event.target.value); setSubmittedSearch(''); }} placeholder="Ex. alternateur ou référence constructeur" />
                  </label>
                </div>
              )}
              {comparisonEnabled && <div className="vin-fields">
                <label htmlFor="offer-reference">Référence OEM à comparer (facultatif)
                  <input id="offer-reference" value={reference} onChange={(event) => { setReference(event.target.value); setSubmittedSearch(''); }} placeholder="Ex. 231008918R — même référence pour neuf et occasion" maxLength={40} />
                </label>
              </div>}
            </form>
            <div className="input-hint">
              <span aria-hidden="true">✳</span>
              {searchType === 'vin'
                ? 'VIN : case E de la carte grise, 17 caractères sans I, O ni Q. Espaces et tirets sont supprimés automatiquement.'
                : searchType === 'plate'
                  ? 'La plaque reste dans cette page. Copiez-la chez le marchand pour identifier le véhicule, puis indiquez la pièce recherchée.'
                  : searchType === 'model'
                    ? 'Saisissez la marque, le modèle, l’année et la pièce. Ajoutez la motorisation dans la description du modèle pour affiner les résultats.'
                    : 'Astuce : une référence OEM précise donne de meilleurs résultats.'}
            </div>
            {searchType === 'vin' && (
              <div className="vin-help">
                <p>Identifiez le véhicule ci-dessus, complétez la motorisation puis choisissez la pièce. Pour obtenir sa référence OEM, consultez un catalogue constructeur avec votre VIN avant de rechercher chez les marchands.</p>
                <a href="https://www.outilsobdfacile.fr/blog/numero-vin-p73.html" target="_blank" rel="noopener noreferrer">Où trouver et comprendre mon VIN ? ↗</a>
                <div className="vin-catalogues">
                  <strong>Retrouver la référence de pièce</strong>
                  <a href="https://www.partslink24.com/" target="_blank" rel="noopener noreferrer">Ouvrir le catalogue constructeur partslink24 ↗</a>
                  <p>Accès externe avec abonnement : copiez votre VIN, sélectionnez le véhicule et relevez la référence OEM. Collez-la dans « Pièce ou référence OEM ».</p>
                  <a href="https://www.tecalliance.net/fr/produits?famille=tecdoc&solution=catalogue-ecommerce" target="_blank" rel="noopener noreferrer">Découvrir le catalogue TecDoc ↗</a>
                  <small>Les références du catalogue ne sont pas encore récupérées dans cette page.</small>
                </div>
              </div>
            )}
            {searchType === 'vin' && vinDetails && (
              <div className="vin-details">
                <strong>VIN au format valide : <code>{vinDetails.vin}</code></strong>
                <dl>
                  <div><dt>WMI · constructeur</dt><dd>{vinDetails.wmi}{vinDetails.manufacturer ? ` · ${vinDetails.manufacturer}` : ' · constructeur non identifié'}</dd></div>
                  <div><dt>VDS · description</dt><dd>{vinDetails.vds}</dd></div>
                  <div><dt>VIS · identification</dt><dd>{vinDetails.vis}</dd></div>
                </dl>
                <p>Le format seul ne confirme ni l’existence du véhicule ni la compatibilité. Complétez les informations du décodeur et faites confirmer la référence par le vendeur.</p>
                <button type="button" onClick={copyVin}>Copier le VIN pour le vendeur</button>
                {copyStatus && <p role="status">{copyStatus}</p>}
              </div>
            )}
            </>}
          </div>

          <div className="photo-box" hidden={searchType === 'vehicles'}>
            <label className="photo-drop" htmlFor="part-photo">
              {image ? (
                <img className="photo-preview" src={image.preview} alt="Aperçu de la pièce à analyser" />
              ) : (
                <span className="photo-icon" aria-hidden="true">＋</span>
              )}
              <span className="photo-title">{image ? image.file.name : 'Une photo de la pièce ?'}</span>
              <span className="photo-subtitle">Déposez ou choisissez une image</span>
            </label>
            <input
              id="part-photo"
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={selectImage}
            />
            {image && (
              <div className="image-api">
                <label className="sr-only" htmlFor="gemini-key">Clé API Gemini</label>
                <input
                  id="gemini-key"
                  type="password"
                  autoComplete="off"
                  placeholder="Clé API Gemini"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <button type="button" onClick={analyzeImage} disabled={isAnalyzing}>
                  {isAnalyzing ? 'Analyse…' : 'Identifier'}
                </button>
                <small>Clé utilisée uniquement dans votre navigateur.</small>
              </div>
            )}
          </div>
        </div>

        {searchType !== 'vehicles' && imageStatus && <p className="success-message" role="status">{imageStatus}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>

      <section className="results-section" aria-labelledby="results-heading" hidden={searchType === 'vehicles'}>
        <div className="results-heading">
          <div>
            <p className="eyebrow">À VOUS DE COMPARER</p>
            <h2 id="results-heading">Choisissez votre terrain de chasse<span>.</span></h2>
          </div>
          <div className="condition-filter" role="group" aria-label="Filtrer par état de la pièce">
            {conditions.map((item) => (
              <button
                className={condition === item.id ? 'selected' : ''}
                key={item.id}
                onClick={() => setCondition(item.id)}
                type="button"
                aria-pressed={condition === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="country-filter" role="group" aria-label="Filtrer par pays">
          {countries.map((item) => (
            <button
              className={country === item.id ? 'selected' : ''}
              key={item.id}
              onClick={() => setCountry(item.id)}
              type="button"
              aria-pressed={country === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="price-note">{comparisonEnabled
          ? 'Comparez les offres accessibles et consultez les autres marchands. Un prix hors port ne permet pas de déterminer le meilleur coût livré.'
          : 'Consultez les prix, les frais de livraison et la disponibilité directement chez chaque marchand. La comparaison automatique des prix est désactivée.'}</p>

        {!submittedSearch ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">⌕</span>
            <p>Entrez une référence, une description, une immatriculation, un VIN ou un modèle avec son année pour préparer vos liens de recherche.</p>
          </div>
        ) : (
          <>
            <div className="query-summary">
              <span>Résultats pour</span> <strong>{submittedSearch}</strong>
              <span className="query-count">{visibleSuppliers.length} marchands</span>
            </div>
            {comparisonEnabled && offerCriteria && <OfferComparison criteria={offerCriteria} country={country} condition={condition} />}
            {(submittedType === 'plate' || submittedType === 'vin' || (submittedType === 'oem' && inputs.vin.trim())) && (
              <p className="privacy-note">
                {submittedType !== 'plate'
                  ? 'Les liens recherchent la pièce et le véhicule renseignés ; ils ne transmettent pas votre VIN. Le décodeur reçoit le VIN uniquement lorsque vous cliquez sur Identifier. Faites confirmer la compatibilité par le vendeur avant achat.'
                  : 'Les liens recherchent la pièce et le véhicule renseignés, sans transmettre votre plaque. Confirmez la compatibilité auprès du vendeur.'}
              </p>
            )}
            <div className="supplier-grid">
              {visibleSuppliers.map((supplier, index) => (
                <article className="supplier-card" key={supplier.id}>
                  <div className="card-topline">
                    <span className={`supplier-logo ${supplier.color}`}>
                      {supplier.name === 'eBay' ? (
                        <span className="ebay-word"><i>e</i><i>b</i><i>a</i><i>y</i></span>
                      ) : supplier.name}
                    </span>
                    <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <span className="country-pill">{supplier.countryLabel}</span>
                  <span className={`category-pill ${supplier.conditions.includes('used') && !supplier.conditions.includes('new') ? 'used' : ''}`}>
                    {supplier.category}
                  </span>
                  <p className="supplier-description">{supplier.description}</p>
                  <a
                    className="supplier-link"
                    href={buildSupplierUrl(supplier, submittedSearch, condition)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir chez {supplier.name} <span aria-hidden="true">↗</span>
                  </a>
                  {supplier.searchVia && <span className="search-via">{supplier.searchVia}</span>}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <footer className="site-footer">
        <span>pieceauto<span className="footer-dot">.</span></span>
        <span>Les liens ouvrent les résultats de recherche des sites marchands. Prix et disponibilité définis par chaque vendeur.</span>
      </footer>
    </main>
  );
}

export default App;
