import { useEffect, useMemo, useState } from 'react';
import { buildSupplierUrl, countries, normalizeSearch, suppliers } from './suppliersConfig.js';

const searchTypes = [
  { id: 'oem', label: 'Référence ou description', icon: '⌕' },
  { id: 'plate', label: 'Immatriculation', icon: '▤' }, { id: 'vin', label: 'N° VIN', icon: '⌗' },
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
  const [input, setInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
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
    const query = normalizeSearch(input, searchType);
    if (searchType === 'vin' && query && !/^[A-HJ-NPR-Z0-9]{17}$/.test(query)) { setError('Le numéro VIN doit contenir 17 lettres ou chiffres, sans I, O ni Q.'); setSubmittedSearch(''); return; } if (!query) {
      setError('Saisissez une référence, une description, une immatriculation ou un numéro VIN.');
      setSubmittedSearch('');
      return;
    }
    setError('');
    setSubmittedSearch(query);
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

      setInput(description);
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

        <div className="search-layout">
          <div className="search-main">
            <div className="search-tabs" role="tablist" aria-label="Type de recherche">
              {searchTypes.map((type) => (
                <button
                  className={`search-tab ${searchType === type.id ? 'active' : ''}`}
                  key={type.id}
                  onClick={() => setSearchType(type.id)}
                  role="tab"
                  aria-selected={searchType === type.id}
                  type="button"
                >
                  <span aria-hidden="true">{type.icon}</span>{type.label}
                </button>
              ))}
            </div>
            <form onSubmit={submitSearch}>
              <label className="sr-only" htmlFor="part-search">
                {searchType === 'vin' ? 'Numéro VIN du véhicule' : searchType === 'plate' ? 'Immatriculation du véhicule' : 'Référence OEM ou description'}
              </label>
              <div className="input-row">
                <span className="input-icon" aria-hidden="true">⌕</span>
                <input
                  id="part-search"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={
                    searchType === 'plate'
                      ? 'Ex. AB-123-CD'
                      : (searchType === 'vin' ? 'Ex. WVWZZZ1JZXW000001' : 'Ex. 8200 123 456 ou alternateur Clio 4')
                  }
                />
                <button className="search-button" type="submit">
                  Trouver ma pièce <span aria-hidden="true">↗</span>
                </button>
              </div>
            </form>
            <div className="input-hint">
              <span aria-hidden="true">✳</span>
              {searchType === 'plate'
                ? 'La plaque est transmise aux marchands ouverts : vérifiez toujours le véhicule proposé.'
                : searchType === 'vin' ? 'Saisissez 17 caractères, sans I, O ni Q. Le VIN n’est pas décodé par l’application.' : 'Astuce : une référence OEM précise donne de meilleurs résultats.'}
            </div>
          </div>

          <div className="photo-box">
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

        {imageStatus && <p className="success-message" role="status">{imageStatus}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>

      <section className="results-section" aria-labelledby="results-heading">
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

        {!submittedSearch ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">⌕</span>
            <p>Entrez une référence, une description, une immatriculation ou un VIN pour préparer vos liens de recherche.</p>
          </div>
        ) : (
          <>
            <div className="query-summary">
              <span>Résultats pour</span> <strong>{submittedSearch}</strong>
              <span className="query-count">{visibleSuppliers.length} marchands</span>
            </div>
            {(searchType === 'plate' || searchType === 'vin') && (
              <p className="privacy-note">
                {searchType === 'vin' ? 'Le VIN sera inclus dans les liens et transmis aux sites marchands au clic. L’application ne décode pas le véhicule : confirmez la compatibilité chez le vendeur.' : 'Votre immatriculation sera incluse dans les liens ouverts. Elle sera transmise aux sites marchands au clic.'}
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
