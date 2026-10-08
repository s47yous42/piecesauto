# Services VIN et catalogue

## Recherche croisée : pièce et véhicule associé au VIN

La description de pièce est partagée entre les onglets. Un VIN saisi reste associé à la recherche par description : les liens marchands contiennent la pièce, la marque, le modèle et la motorisation identifiés ou renseignés, jamais le VIN complet. Le véhicule ciblé est affiché avec une action pour le retirer. Modifier le VIN invalide le véhicule précédemment confirmé. Tant qu’un VIN associé est invalide ou non identifié, la recherche par description demande une identification ou une saisie manuelle au lieu de produire des liens génériques.

### Types constructeur documentés

Une table locale limitée reconnaît les types Mercedes-Benz `WDB123223`, `WDB123243` et `WDB123283` (neuf premiers caractères) : respectivement 230 E / W123, 230 CE / C123 et 230 TE / S123, avec moteur d’origine M102.980 de 2,3 L essence. Source : [catalogue du fabricant Motorservice / Pierburg](https://www.ms-motorservice.com/MediaAssets/2486694_pg_50003569_web.pdf), rubriques 123 Coupé, berline et break. Cette table est déclarée dans `src/vinProfiles.js` ; elle ne contient aucun numéro de série individuel.

Pour un VIN commençant par `WDB123243` et `moteur 2.3l E`, la requête contient donc la pièce et `Mercedes-Benz 230 CE C123 M102.980 2.3 L essence`, dans les deux onglets. Cette identification par type s’effectue localement, sans envoi du VIN à vPIC. Elle ne décode ni l’année de cet exemplaire, ni ses équipements, ni un éventuel moteur remplacé. Le champ modèle / motorisation permet de préciser le moteur réellement monté. Une cylindrée, un code moteur complet ou un carburant explicitement contradictoires avec le profil d’origine déclenchent une demande de vérification.

Les marchands appliquent leurs propres moteurs de recherche : les liens ainsi ciblés ne certifient pas chaque annonce ni la compatibilité du montage. Une référence constructeur et une vérification par le vendeur restent nécessaires avant achat.

## Service pour les autres VIN : NHTSA vPIC

Le bouton d’identification appelle directement depuis le navigateur :
`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json`.

Documentation : https://vpic.nhtsa.dot.gov/api/
Couverture : https://vpic.nhtsa.dot.gov/api/home/index/faq

Ce service public gratuit ne nécessite pas de clé. Il couvre les véhicules déclarés pour le marché américain et peut retourner des informations incomplètes pour les véhicules européens. Il ne fournit pas de références de pièces ou de compatibilité. Le VIN est envoyé uniquement au clic, sans stockage local par l’application. Les requêtes sont annulées après 20 secondes et lorsque le VIN ou le mode de recherche change.

Les champs retournés sont affichés, sans inférence du moteur ou de la finition. Pour les réponses vPIC, le remplissage du véhicule est proposé uniquement si le service retourne une marque, un modèle et un ErrorCode égal à 0 ; l’utilisateur confirme les informations. Sinon la saisie manuelle reste disponible. Le véhicule confirmé sert aussi aux recherches depuis l’onglet description.

## Catalogue : intégration API en attente

Le site propose un lien externe vers partslink24 et une présentation de TecDoc. Ces liens ne constituent pas une connexion API. L’utilisateur copie son VIN, consulte le catalogue avec son propre accès, puis reporte la référence OEM dans la recherche marchands.

Pour connecter réellement un catalogue européen, obtenir un accès TecDoc Web Service et Vehicle Identification Service auprès de TecAlliance : https://www.tecalliance.net/products . Vérifier la couverture VIN des pays et marques souhaités, les droits de publication des données et les opérations disponibles dans le contrat.

Une fois l’accès obtenu, il faudra héberger un service serveur séparé de GitHub Pages, conserver les identifiants côté serveur, identifier le véhicule via le service VIN, proposer les variantes retournées et récupérer les articles associés à l’identifiant véhicule choisi. Les endpoints et formats doivent venir de la documentation du compte fournisseur ; aucun endpoint privé fictif n’a été ajouté.

GitHub Pages héberge uniquement le client statique. Aucune clé de catalogue ne doit être placée dans une variable VITE_* ou un fichier public.

## Vérification

`npm test` vérifie les modes description / plaque / VIN, validation, normalisation, réponses complètes / partielles, erreurs API et absence des identifiants dans les liens marchands. `npm run build` vérifie la compilation. `npm run test:e2e` teste les trois parcours dans un navigateur, les filtres, la copie de plaque, les erreurs API, l’annulation des réponses obsolètes, les changements d’onglet et le mobile. Les appels vPIC sont simulés dans les tests navigateur pour vérifier les succès et les échecs de manière reproductible. Le workflow Pages lance tous ces tests avant de publier.

La recherche par plaque est guidée : la plaque est copiée dans le formulaire du marchand, puis le modèle identifié et la pièce sont renseignés dans le site. Un accès VRM fournisseur sera nécessaire pour rendre cette identification automatique. Les tests ne garantissent pas la compatibilité réelle des pièces ni le fonctionnement des sites marchands.
