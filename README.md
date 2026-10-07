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
- Les filtres d’état affichent les marchands configurés pour le neuf ou l’occasion.
- Une immatriculation est transmise au site marchand lorsque l’utilisateur ouvre un lien ; elle n’est pas décodée en véhicule par l’application.
- L’analyse de photo est facultative et envoie l’image directement à l’API Gemini depuis le navigateur. L’utilisateur fournit lui-même sa clé, qui n’est pas enregistrée par l’application, mais reste accessible dans le navigateur et dans les outils réseau. Pour un usage public, préférez une fonction serverless avec une clé stockée côté serveur et des limites d’utilisation.
