# Pipelines A et B — guide de compréhension

[← Index specs](README.md) · Voir aussi [technique.md](technique.md) · [donnees.md](donnees.md)

Ce document explique **pourquoi** le projet a deux pipelines distincts, **ce que chacun fait (et ne fait pas)**, et **quand** utiliser l'un ou l'autre.

---

## 1. Pourquoi deux pipelines ?

Le site AFD expose ~180 fiches podcasts pour l'édition 2026, mais seules ~60–80 sont **actives** (votes ouverts) à un instant donné. Le projet doit :

1. **Mettre à jour le classement** plusieurs fois par jour → rapide, automatique.
2. **Re-vérifier l'état de toutes les fiches** (ouvert / fermé / inéligible) → lent, à la demande (Pipeline B).

Un seul pipeline qui visiterait ~180 fiches à chaque cron (2×/jour) serait trop long (~30+ min) et inutilement agressif envers le site AFD. D'où la séparation :

| Pipeline | Rôle | Fréquence |
|----------|------|-----------|
| **A** | Suivi des votes sur les participants actifs | Automatique 06h / 16h |
| **B** | Audit complet + rapport de changements | Manuel |

---

## 2. Comparaison rapide

| | **Pipeline A** | **Pipeline B** |
|---|----------------|----------------|
| **Workflow GitHub** | `scrape.yml` | `discover.yml` |
| **Script** | `run-pipeline.js` | `run-discover.js` |
| **Commande locale** | `npm run pipeline` | `npm run discover` |
| **Déclenchement** | Cron 06h / 16h (Paris) + manuel possible | **Manuel uniquement** (collaborateur repo) |
| **Durée typique** | ~4–8 min | ~10–18 min |
| **Pages liste AFD** | Non | Oui (~11 pages) |
| **Fiches visitées** | Actifs (`active: true`) uniquement | **Toutes** (~180) |
| **Fiches inactives connues** | **Pas re-visitées** | **Re-visitées** |
| **Scraping des votes** | Oui | Non |
| **Détection d'anomalies** | Oui | Non |
| **Rapport de diff** | Non | Oui → `sync-report.json` |
| **Fichier de statut** | `meta.json` | `sync-report.json` |

---

## 3. Pipeline A — votes (automatique)

### Chaîne d'exécution

```
scrape-votes.js → detect-alerts.js → publish-data.js
```

La liste des podcasts AFD est considérée **figée** : le pipeline automatique ne re-parcourt plus les pages liste pour détecter de nouveaux slugs. Pour mettre à jour le catalogue (`participants.json`), lancer **Pipeline B**.

### Étape 1 — `scrape-votes.js`

- Parcourt `participants.json` où `active: true`.
- Lit le compteur de votes sur chaque fiche active.
- Ajoute un snapshot dans `votes-history.json` (horodaté à l'heure du run).
- **Cas particulier :** si une fiche **déjà active** affiche « Votes clôturés », elle passe `active: false` / `voteStatus: closed` lors de ce scrape (pas besoin de Pipeline B pour *cette* transition).

### Étape 2 — `detect-alerts.js`

Recalcule les baselines et le score de suspicion → `stats.json`, `alerts.json`. Voir [detection-anomalies.md](detection-anomalies.md).

### Étape 3 — `publish-data.js`

Copie `data/` → `public/data/`, commit + push (en Actions).

### Ce que Pipeline A ne fait **pas**

| Situation | Comportement Pipeline A |
|-----------|-------------------------|
| Podcast **inactif connu** dont les votes **rouvrent** | **Non détecté** — la fiche n'est pas re-visitée |
| Podcast **inactif connu** dont le statut change (hors clôture détectée sur un actif) | **Non détecté** |
| Mise à jour des métadonnées (titre, école…) d'un inactif | **Non** |
| Rapport détaillé ouvert / fermé / nouveau | **Non** — utiliser Pipeline B |
| Nouveau slug sur la liste AFD | **Non détecté** — lancer Pipeline B |

> Les runs automatiques 06h/16h **ne modifient pas** le statut des inactifs connus — sauf clôture détectée sur un participant encore marqué actif. Pour un audit complet, lancer **Pipeline B**.

---

## 4. Pipeline B — découverte (manuel)

### Chaîne d'exécution

```
discover-participants.js → diff avant/après → sync-report.json → publish-data.js
```

### Étapes

1. Snapshot « avant » de `participants.json` (en mémoire).
2. Crawl complet de la liste (même filtre édition 2026).
3. Visite **chaque fiche** — connue ou nouvelle (~180).
4. Met à jour `participants.json` (merge, **jamais de suppression**).
5. Calcule le diff avant/après → `sync-report.json`.
6. Publie via `publish-data.js`.

### Ce que Pipeline B apporte en plus

| Capacité | Détail |
|----------|--------|
| Re-validation des **inactifs connus** | Détecte votes rouverts, clôturés, changements de statut |
| Rapport public | `decouverte.html` — ouverts, fermés, nouveaux, inchangés |
| Bootstrap initial | **Obligatoire une fois** avant le premier cron de votes en prod |

Pipeline B **ne scrape pas les votes** et **ne calcule pas les alertes** — il met à jour le catalogue et produit le rapport.

---

## 5. Schéma — qui visite quoi ?

```text
                    ┌─────────────────────────────────────┐
                    │         Pages liste AFD (~11)        │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │   Pipeline B    │
                             │   discover      │
                             └────────┬────────┘
                                      │
                                      │  TOUTES les fiches
                                      ▼
                             ┌─────────────────┐
                             │  ~180 fiches    │
                             │  (chaque run)   │
                             └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │  sync-report    │
                             │  (diff détaillé)│
                             └─────────────────┘

     participants.json (figé)  ──►  ┌─────────────────┐
                                     │   Pipeline A    │
                                     │  scrape-votes   │
                                     └────────┬────────┘
                                              │
                                              │  active:true
                                              ▼
                                     ┌─────────────────┐
                                     │  ~60–80 fiches  │
                                     └─────────────────┘
```

---

## 6. Scénarios courants

| Situation | Pipeline à utiliser |
|-----------|---------------------|
| Premier déploiement en prod | **B** une fois, puis laisser **A** tourner en cron |
| Mise à jour quotidienne du classement | **A** (automatique) |
| Nouveau podcast apparaît sur la liste AFD | **B** |
| Fin de concours / beaucoup de clôtures à vérifier | **B** (rapport sur `decouverte.html`) |
| Un inactif connu rouvre ses votes | **B** — Pipeline A ne le verra pas |
| Vérifier localement avant push | `npm run pipeline` ou `npm run discover` |

---

## 7. Fichiers produits

| Fichier | Pipeline | Contenu |
|---------|----------|---------|
| `participants.json` | B (complet) · A (mise à jour vote/clôture sur actifs) | Catalogue des podcasts suivis |
| `votes-history.json` | A | Historique des snapshots de votes |
| `alerts.json` / `stats.json` | A | Scores de suspicion |
| `meta.json` | A | Statut du dernier run votes |
| `sync-report.json` | B | Rapport de diff (ouverts, fermés, nouveaux…) |
| `execution-journal.log` | A et B | Journal public des exécutions (5 j) |

Schémas détaillés : [donnees.md](donnees.md).

---

## 8. Logs de progression

Les deux pipelines partagent le même format de logs console :

```text
[pipeline] Parcours liste AFD [████░░░░░░░░░░░░░░░░] 3/11 (27%) — page 2 · 142 slugs liste — 45s écoulé, ~2m restant
[pipeline] Collecte des votes [██████████░░░░░░░░░░] 40/78 (51%) — mon-podcast · Δ+3 (436→439) · ΣΔ+87 — 3m écoulé, ~3m restant
[discover] Visite des fiches [████░░░░░░░░░░░░░░░░] 12/180 (7%) — autre-podcast · 180 slugs liste — 1m écoulé, ~14m restant
```

Pendant le scrape (Pipeline A), chaque fiche loggue le **delta** par rapport au dernier snapshot (`Δ+3 · 436→439`) et le **cumul** de tous les deltas du run (`ΣΔ+87`).

| Pipeline | Préfixe console | Fichier mis à jour pendant le run |
|----------|-----------------|-----------------------------------|
| A | `[pipeline]` | `meta.json` (`lastRunStatus: running`, `progress`) |
| B | `[discover]` | `sync-report.json` (`status: running`, `progress`) |

Phases Pipeline A : `scrape_votes` uniquement.

---

## 9. Commandes et URLs

| Action | Local | GitHub Actions |
|--------|-------|----------------|
| Pipeline A | `npm run pipeline` | `scrape.yml` (cron + `workflow_dispatch`) |
| Pipeline B | `PIPELINE_TRIGGER=local npm run discover` | `discover.yml` (`workflow_dispatch`) |
| Publier sans scrape | `npm run publish` | — |

- Classement : `index.html`
- Rapport découverte : `decouverte.html`
- Lancer B en prod : Actions → **Discover participants** (collaborateur repo requis pour le bouton Run)

---

## 10. FAQ

### « Pipeline A ne parcourt plus la liste — comment ajouter un nouveau slug ? »

La liste AFD est considérée figée pour la fin du concours. Lancer **Pipeline B** si le catalogue doit être resynchronisé.

### « Pipeline A et B parcourent tous les deux la liste — c'est redondant ? »

**Non** : seul Pipeline B parcourt encore les pages liste. Pipeline A part de `participants.json` et ne visite que les fiches actives pour collecter les votes.

### « Un participant inactif peut-il redevenir actif sans Pipeline B ? »

**Non**, si on ne l'a jamais re-scrapé comme actif. Pipeline A ignore les inactifs connus. Seul B re-visite ces fiches et met à jour `active` / `voteStatus`.

### « Un participant actif peut-il passer inactif sans Pipeline B ? »

**Oui**, si « Votes clôturés » est détecté lors de `scrape-votes.js` sur une fiche encore marquée active.

---

## 11. Références

- Flux détaillés et scraping HTML : [technique.md § 5](technique.md#5-flux-opérationnels)
- Besoins fonctionnels : [fonctionnel.md § BF-05 / BF-06](fonctionnel.md#bf-05--actualisation-des-votes-automatique)
- Prise en main : [README.md](../README.md)
