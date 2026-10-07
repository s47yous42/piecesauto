# PieceAuto

Application React + Vite entièrement statique pour préparer des recherches de pièces auto chez plusieurs marchands. Aucun backend ni scraping n’est utilisé : les liens ouvrent les recherches des sites marchands, ou une recherche web ciblée pour les sites sans URL de recherche publique stable.

## Développement local

Prérequis : Node.js 20 ou supérieur.

```sh
npm install
npm run dev
```

Pour vérifier le build de production :

```sh
npm run build
npm run preview
```

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit puis déploie `dist` à chaque push sur `main` (et peut être lancé manuellement). Dans **Settings → Pages**, sélectionnez **GitHub Actions** comme source de déploiement.

`vite.config.js` utilise un chemin relatif (`base: './'`) pour que l’application fonctionne aussi dans un dépôt de projet GitHub Pages.

## Recherche et confidentialité

- Le moteur de liens et la liste des marchands sont dans `src/suppliersConfig.js`.
- Les filtres combinables par pays et par état couvrent la France, l’Allemagne, l’Italie, l’Espagne, les Pays-Bas, la Pologne, l’Autriche et la Belgique. Les recherches utilisent notamment AUTODOC, eBay et des vendeurs locaux tels que Winparts, iParts, Allegro et DAPARTO.
- Les catalogues européens dont l’URL de recherche n’est pas stable utilisent une recherche web ciblée vers le domaine du vendeur.
- Une immatriculation est transmise au site marchand lorsque l’utilisateur ouvre un lien ; elle n’est pas décodée en véhicule par l’application. La recherche VIN normalise les espaces et tirets, puis vérifie le format (17 caractères, sans I, O ni Q). Le VIN est transmis aux marchands au clic, mais l’application ne décode pas le véhicule et ne garantit pas la compatibilité de la pièce : confirmez-la auprès du vendeur.
- L’analyse de photo est facultative et envoie l’image directement à l’API Gemini depuis le navigateur. L’utilisateur fournit lui-même sa clé, qui n’est pas enregistrée par l’application, mais reste accessible dans le navigateur et dans les outils réseau. Pour un usage public, préférez une fonction serverless avec une clé stockée côté serveur et des limites d’utilisation.
