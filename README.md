# PieceAuto

Application React + Vite pour rechercher des pièces auto chez plusieurs marchands européens. Sur GitHub Pages, les recherches et les liens marchands sont disponibles ; le comparateur automatique est désactivé. Une version locale ajoute un serveur Node.js lisant les annonces publiques accessibles, sans clé API, pour rapprocher les prix neuf/occasion par référence OEM. Voir [la comparaison de prix et ses limites](docs/PRICE-COMPARISON.md).

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

Pour utiliser le comparateur local : `npm run build:comparison`, puis `npm start` et ouvrir http://127.0.0.1:4173. Il est prévu pour la livraison à **69390 Vernaison, France**. Le comparateur ne fonctionne pas sur GitHub Pages sans hébergement serveur supplémentaire. `npm run build` produit toujours la version statique sans comparateur.

Tests avant publication statique : `npm test`, `npm run build`, puis `npm run test:e2e`. Ces tests vérifient notamment que les quatre modes de recherche conservent les liens marchands sans appeler le service de comparaison. Les tests navigateur utilisent Chrome installé sous Windows ; sur Linux, installer Chromium avec `npx playwright install --with-deps chromium`. Le workflow GitHub Pages exécute ces vérifications avant de déployer.

Pour vérifier le comparateur local : `npm run build:comparison`, `npm run test:e2e:comparison`, puis `npm run test:live`. Les sources inaccessibles ou l’absence d’un prix livré valide bloquent sa validation pour une publication avec serveur. Ce contrôle réel reste obligatoire pour le comparateur, mais ne bloque plus le site statique où il est désactivé.

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit puis déploie `dist` à chaque push sur `main` (et peut être lancé manuellement). Dans **Settings → Pages**, sélectionnez **GitHub Actions** comme source de déploiement.

`vite.config.js` utilise un chemin relatif (`base: './'`) pour que l’application fonctionne aussi dans un dépôt de projet GitHub Pages.

## Recherche et confidentialité

Le bouton « Identifier le véhicule avec le VIN » utilise désormais le service public NHTSA vPIC sans clé. Le VIN est transmis à ce service au clic. La couverture des véhicules européens peut être incomplète ; les données doivent être vérifiées avant d’être reprises dans la recherche. Le décodeur n’identifie pas les pièces compatibles. Les catalogues partslink24 et TecDoc sont proposés en accès externe, sans récupération automatique de leurs références. Une connexion API au catalogue nécessite un accès fournisseur et un service serveur séparé de GitHub Pages. Voir [les services VIN et catalogue](docs/VIN-SERVICES.md).

- Le moteur de liens et la liste des marchands sont dans `src/suppliersConfig.js`.
- Les filtres combinables par pays et par état couvrent la France, l’Allemagne, l’Italie, l’Espagne, les Pays-Bas, la Pologne, l’Autriche et la Belgique. Les recherches utilisent notamment AUTODOC, eBay et des vendeurs locaux tels que Winparts, iParts, Allegro et DAPARTO.
- Les catalogues européens dont l’URL de recherche n’est pas stable utilisent une recherche web ciblée vers le domaine du vendeur.
- Le mode description recherche directement une référence ou un descriptif de pièce. Le mode plaque vérifie un format alphanumérique et permet de copier l’immatriculation pour identifier un véhicule français chez Oscaro. L’utilisateur reporte ensuite le modèle et la motorisation et renseigne la pièce. La plaque n’est pas envoyée dans les liens de recherche ; l’application ne dispose pas encore d’une API d’identification par plaque.
- La recherche VIN normalise les espaces et les tirets, puis vérifie le format (17 caractères, sans I, O ni Q). Elle affiche les sections WMI (3 caractères), VDS (6) et VIS (8), avec une identification indicative du constructeur pour certains WMI documentés. Le modèle / motorisation, saisis ou repris du décodeur après confirmation, et la pièce sont nécessaires pour préparer les liens marchands ; le VIN n’est pas inclus dans ces liens. Un bouton permet de le copier pour faire confirmer la compatibilité par le vendeur. Source : [Outils OBD Facile](https://www.outilsobdfacile.fr/blog/numero-vin-p73.html).
- L’analyse de photo est facultative et envoie l’image directement à l’API Gemini depuis le navigateur. L’utilisateur fournit lui-même sa clé, qui n’est pas enregistrée par l’application, mais reste accessible dans le navigateur et dans les outils réseau. Pour un usage public, préférez une fonction serverless avec une clé stockée côté serveur et des limites d’utilisation.
