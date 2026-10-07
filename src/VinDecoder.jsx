import { useEffect, useRef, useState } from 'react';
import { decodeVin } from './vinDecoder.js';
import { inspectVin } from './vin.js';

export default function VinDecoder({ vin, onVehicle }) {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef(null);

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setResult(null);
    setStatus('');
    setLoading(false);
    return () => { request.current?.abort(); request.current = null; };
  }, [vin]);

  const identify = async () => {
    const details = inspectVin(vin);
    if (details.error) { setStatus(details.error); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setResult(null);
    setStatus('');
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const decoded = await decodeVin(details.vin, { signal: controller.signal });
      if (request.current !== controller || controller.signal.aborted) return;
      setResult(decoded);
      setStatus(decoded.warning || 'Véhicule identifié : vérifiez les informations avant de les utiliser.');
    } catch (error) {
      if (request.current === controller) setStatus(error.name === 'AbortError' ? 'Le service met trop de temps à répondre. Réessayez ou renseignez le véhicule manuellement.' : 'Décodage impossible. Vérifiez votre connexion et le VIN, ou renseignez le véhicule manuellement.');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setLoading(false);
    }
  };

  return (
    <div className="vin-decoder">
      <button type="button" onClick={identify} disabled={loading}>{loading ? 'Identification…' : 'Identifier le véhicule avec le VIN'}</button>
      <p>Au clic, le VIN est envoyé au service public NHTSA vPIC. Couverture limitée pour les véhicules européens ; le VIN n’est pas enregistré par cette application.</p>
      {status && <p role="status">{status}</p>}
      {result && (
        <>
          <dl>
            <div><dt>Marque / modèle</dt><dd>{[result.make, result.model].filter(Boolean).join(' ') || 'Non identifié'}</dd></div>
            <div><dt>Année modèle</dt><dd>{result.year || 'Non renseignée'}</dd></div>
            <div><dt>Moteur / cylindrée</dt><dd>{[result.engine, result.capacity].filter(Boolean).join(' · ') || 'Non renseignés'}</dd></div>
          </dl>
          {result.reliable && <button type="button" onClick={() => { onVehicle(result.description); setStatus('Informations reprises dans la recherche. Complétez la motorisation si nécessaire.'); }}>Utiliser ce véhicule dans la recherche</button>}
        </>
      )}
    </div>
  );
}
