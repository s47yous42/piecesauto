# Services VIN et catalogue

## Service actif : NHTSA vPIC

Le bouton d’identification appelle directement depuis le navigateur :
`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json`.

Documentation : https://vpic.nhtsa.dot.gov/api/
Couverture : https://vpic.nhtsa.dot.gov/api/home/index/faq

Ce service public gratuit ne nécessite pas de clé. Il couvre les véhicules déclarés pour le marché américain et peut retourner des informations incomplètes pour les véhicules européens. Il ne fournit pas de références de pièces ou de compatibilité. Le VIN est envoyé uniquement au clic, sans stockage local par l’application. Les requêtes sont annulées après 20 secondes et lorsque le VIN ou le mode de recherche change.

Les champs retournés sont affichés, sans inférence du moteur ou de la finition. Le remplissage du véhicule est proposé uniquement si le service retourne une marque, un modèle et un ErrorCode égal à 0 ; l’utilisateur confirme les informations. Sinon la saisie manuelle reste disponible.

## Catalogue : intégration API en attente

Le site propose un lien externe vers partslink24 et une présentation de TecDoc. Ces liens ne constituent pas une connexion API. L’utilisateur copie son VIN, consulte le catalogue avec son propre accès, puis reporte la référence OEM dans la recherche marchands.

Pour connecter réellement un catalogue européen, obtenir un accès TecDoc Web Service et Vehicle Identification Service auprès de TecAlliance : https://www.tecalliance.net/products . Vérifier la couverture VIN des pays et marques souhaités, les droits de publication des données et les opérations disponibles dans le contrat.

Une fois l’accès obtenu, il faudra héberger un service serveur séparé de GitHub Pages, conserver les identifiants côté serveur, identifier le véhicule via le service VIN, proposer les variantes retournées et récupérer les articles associés à l’identifiant véhicule choisi. Les endpoints et formats doivent venir de la documentation du compte fournisseur ; aucun endpoint privé fictif n’a été ajouté.

GitHub Pages héberge uniquement le client statique. Aucune clé de catalogue ne doit être placée dans une variable VITE_* ou un fichier public.

## Vérification

`npm test` vérifie validation, normalisation, réponses complètes / partielles, erreurs API et absence du VIN dans les liens marchands. `npm run build` vérifie la compilation. Le workflow Pages lance ces tests avant de publier.
