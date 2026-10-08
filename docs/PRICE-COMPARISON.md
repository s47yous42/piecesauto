# Comparaison de prix — fonctionnalité locale désactivée sur GitHub Pages

Le comparateur lit des pages publiques depuis un petit serveur Node.js sans clé API. Il affiche séparément les annonces neuves et d’occasion et leur référence OEM. Livraison cible : **69390 Vernaison, France**.

## Utiliser la version locale

Avec Node.js installé : `npm run build:comparison`, puis `npm start`. Ouvrir http://127.0.0.1:4173. Le serveur sert le client et `/api/offers` depuis la même origine. Il écoute seulement sur l’interface locale.

GitHub Pages héberge des fichiers statiques et ne peut pas exécuter ce serveur. Pour rendre la comparaison publique, il reste à choisir un hébergement serveur et à relier le client au service public. Aucune clé secrète, aucun proxy CORS public ni endpoint privé marchand n’est utilisé.

Le build par défaut (`npm run build`) désactive le comparateur et son champ de référence supplémentaire. Les recherches, le décodage VIN à la demande, les filtres et les liens marchands restent disponibles. Aucun appel à `/api/offers` n’est effectué dans cette version. L’interface indique de consulter les prix et frais de livraison chez les vendeurs.

## Sources et limites

Les recherches publiques couvrent Leboncoin (France), Kleinanzeigen (Allemagne), Subito (Italie), Milanuncios (Espagne), Marktplaats (Pays-Bas), OLX (Pologne), Willhaben (Autriche) et 2ememain (Belgique). Les autres vendeurs restent accessibles par leurs liens de recherche.

Les annonces sont extraites des données JSON-LD `Offer`, des données de listes Marktplaats/2ememain et des listes Willhaben embarquées dans les pages. Les résumés `AggregateOffer.lowPrice`, les textes décrivant globalement la recherche, les enchères et les annonces réservées ne deviennent jamais une offre individuelle. Une page sans données exploitables est signalée, pas assimilée à une absence d’offres. Les refus d’accès et captchas sont signalés sans contournement.

Une même référence OEM explicitement mentionnée sur les deux annonces permet de proposer un rapprochement occasion/neuf. Il s’agit d’une indication du vendeur, **pas d’une validation du montage par catalogue constructeur**. Sans référence, les annonces correspondant au descriptif restent des candidats et ne sont pas nommées équivalents confirmés. Les connecteurs, supports, courroies et poulies sont exclus des recherches d’organes complets ; les pièces signalées défectueuses et les services de réparation sont écartés.

La comparaison porte sur la première page lisible de chaque source, pas sur un minimum garanti dans toute l’Europe. Une condition inconnue ou reconditionnée n’est pas assimilée à du neuf. Les prix en devises peuvent être convertis approximativement avec un taux [BCE daté](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) de moins de sept jours. Sans taux valide, l’annonce conserve sa devise et ne gagne pas le classement en euros.

Les frais de livraison ne sont pas déduits d’un montant national ou d’une mention « envoi possible ». Un total livré exige un montant explicite applicable au pays **et au code postal** de destination. Les pages publiques consultées ne fournissent actuellement pas cette preuve pour 69390 : les cartes affichent « total inconnu ».

## Validation et condition de publication

- `npm test` : logique des quatre modes, extraction, correspondances, rejets, devises, dates, livraison, filtres, validation HTTP et gestion des sources bloquées.
- `npm run build` puis `npm run test:e2e` : compilation et parcours du site statique, avec vérification de l’absence d’appel au service de comparaison.
- `npm run build:comparison` puis `npm run test:e2e:comparison` : compilation du comparateur local et parcours description, plaque, VIN, modèle/année, huit pays, états, absence de résultat, annulation, mobile et photo avec réponses simulées.
- `npm run test:live` : annonces publiques réelles pour la référence de contrôle **231008918R**, distinction neuf/occasion, disponibilité des huit sources et prix livré à 69390. Rapport : `test-results/live-marketplaces.json`.

Le contrôle réel échoue actuellement : certaines sources sont bloquées ou non exploitables, et la livraison à 69390 n’est pas chiffrée. **Le code est envoyé à GitHub, mais la mise en ligne du comparateur reste bloquée.** Le workflow GitHub Pages déploie seulement la version statique avec comparateur désactivé, après les tests unitaires et navigateur. Le contrôle réel reste obligatoire avant une future publication du comparateur sur un hébergement serveur.

Les tests simulés ne valident ni une annonce réelle ni une compatibilité physique. Le contrôle réel utilise une pièce de contrôle ; il ne certifie pas toutes les références possibles. Pour certifier une pièce demandée, il faut la référence OEM et les caractéristiques exactes du véhicule et de la pièce.
