# Spécifications fonctionnelles

[← Index](README.md)

---

## 1. Contexte

Les collégiens et lycéens participent au concours de podcasts [Réinventer le monde](https://offre-pedagogique.afd.fr/fr/reinventer-le-monde) organisé par l'AFD. Chaque podcast dispose d'un bouton de vote sur sa fiche ; le nombre de votes est affiché, mais **aucun classement global ni historique** n'existe.

Les organisateurs et participants ont besoin de :
- suivre le **classement complet** en un coup d'œil ;
- visualiser l'**évolution des votes** dans le temps ;
- repérer des **hausses anormales** susceptibles d'indiquer une triche (votes automatisés, campagnes massives).

---

## 2. Objectifs

Une page web unique, ludique et publique, qui affiche :

1. Le **classement complet** des participants (tableau détaillé + podium visuel top 3).
2. L'**évolution temporelle des votes** par participant (graphique).
3. Des **alertes automatiques adaptatives** pour signaler des hausses statistiquement inhabituelles.

**Source des données :** site [Offre pédagogique AFD](https://offre-pedagogique.afd.fr/fr/publications/liste?words=&type%5B6%5D=6&thematic%5B389%5D=389&location=) (podcasts + programme **Edition 2026**).

---

## 3. Périmètre des podcasts suivis

### Le filtre `type=6` n'est pas limité à l'édition 2026

Le filtre « Podcast (concours Réinventer le monde) » regroupe **toutes les éditions** du concours (~9 pages, ~180 fiches).

**Exemple hors édition 2026 (votes clôturés) :**
- [Les J.O, un iceberg social](https://offre-pedagogique.afd.fr/fr/ressources/les-jo-un-iceberg-social) — **Édition 2024**, « Votes clôturés ».

**Exemple édition 2026 (votes ouverts) :**
- [Les filles aussi ont des ailes](https://offre-pedagogique.afd.fr/fr/ressources/les-filles-aussi-ont-des-ailes) — **Édition 2026**, « Je vote pour ce podcast (439) Likes ».

### Règle de filtrage

Ne suivre que les podcasts dont la fiche indique **`Edition 2026`** ET dont les votes ne sont **pas clôturés**.

La découverte passe par la liste paginée, mais **chaque fiche est validée** avant d'être ajoutée au suivi.

---

## 4. Décisions validées

| Sujet | Décision |
|-------|----------|
| Édition | Uniquement **2026**, votes ouverts |
| Accès | **Tout public** — site, données JSON, rapport découverte, repo git ; sans authentification |
| Fuseau horaire | **Europe/Paris** |
| Mise à jour des votes | **Automatique** (fréquence configurable via cron GitHub Actions, ex. 2×/jour) |
| Sync liste participants | **Figée** en prod (Pipeline A) · **Complet manuel** via Pipeline B si resync |
| Détection triche | **Score adaptatif** basé sur l'activité historique — voir [detection-anomalies.md](detection-anomalies.md) |
| Stockage | **Fichiers JSON** + backups rotatifs (pas de BDD) |
| Qualité code | Quick & dirty, acceptable pour la durée du projet |
| Hébergement | Gratuit, avec cron intégré — voir [technique.md](technique.md) |
| Stack | Node.js 20 · Vanilla JS · Chart.js · GitHub Pages + Actions |
| Repo | **Public** — aucun secret ni donnée confidentielle ([public-repo.md](public-repo.md)) |
| Config locale | **`.env`** (non versionné) pour `GITHUB_OWNER` / liens du site |
| Données initiales | JSON vides auto-créés · **`npm run seed-demo`** pour extrait fictif de dev |

---

## 5. Besoins fonctionnels

### BF-01 — Classement

- Afficher tous les participants actifs triés par nombre de votes décroissant.
- Afficher le rang, la variation de rang et la variation de votes sur les dernières 24 h.
- Lien vers la fiche officielle AFD de chaque podcast.

### BF-02 — Podium

- Mettre en avant le top 3 avec un visuel podium (or / argent / bronze).
- Afficher titre, école et nombre de votes pour chaque marche.

### BF-03 — Historique graphique

- Courbe d'évolution des votes par participant, sur la base des snapshots collectés.
- Possibilité de comparer plusieurs participants (max 10 courbes).
- Raccourci « comparer le top 5 ».

### BF-04 — Détection de votes suspects

- Calculer un score de suspicion (0–100) adaptatif pour chaque participant.
- Générer des alertes explicites en français lorsque l'activité dépasse les baselines historiques.
- Permettre de filtrer les participants suspects.
- Voir le détail dans [detection-anomalies.md](detection-anomalies.md).

### BF-05 — Actualisation des votes (automatique)

- Collecter les votes pour les participants déjà actifs dans `participants.json` à chaque exécution du pipeline (horodatage réel du run, pas de créneaux fixes).
- Conserver l'historique même si un participant devient inactif.

Voir [pipelines.md](pipelines.md) pour le détail du compromis A / B.

### BF-06 — Découverte manuelle et rapport de changements

- Permettre de lancer **à la demande** (collaborateur du repo via GitHub Actions) une re-validation complète de toutes les fiches.
- Afficher un **rapport détaillé public** sur `/decouverte.html` listant à chaque lancement :
  - podcasts dont les votes **viennent d'ouvrir** ;
  - podcasts dont les votes **viennent de fermer** ;
  - podcasts **nouvellement découverts** ;
  - métadonnées mises à jour ;
  - nombre de fiches inchangées.
- Le rapport et les JSON associés sont **publics** (pas de contenu confidentiel).

Voir [pipelines.md](pipelines.md), [technique.md § 5.2](technique.md#52-pipeline-b--découverte-manuelle-t6) et [public-repo.md](public-repo.md).

### BF-07 — Transparence

- Afficher la date/heure du dernier relevé.
- Afficher un disclaimer : classement non officiel, basé sur des données publiques.

---

## 6. Critères d'acceptation

- [ ] La page affiche le classement de tous les podcasts 2026 à votes ouverts
- [ ] Le podium top 3 est visuellement attractif (or/argent/bronze)
- [ ] Le tableau est triable et filtrable
- [ ] Le graphique montre l'évolution sur au moins 2 snapshots
- [ ] Les alertes s'adaptent à l'activité historique (pas de seuils fixes)
- [ ] Le score de suspicion (0–100) et les messages explicatifs sont affichés
- [ ] Pas d'alerte avant 3 snapshots (phase d'échauffement)
- [ ] Les données se mettent à jour sans intervention à la fréquence configurée du cron
- [ ] La découverte manuelle affiche précisément les ouvertures/fermetures de vote
- [ ] Relancer un pipeline manuellement n'efface pas l'historique
- [ ] Le site et toutes les données sont publics, sans secret dans le repo
- [ ] Les requêtes de scraping ne déclenchent pas de blocage sur une semaine de test
