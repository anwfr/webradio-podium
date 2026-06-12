# Modèle de données

[← Index](README.md) · Voir aussi [technique.md](technique.md) · [public-repo.md](public-repo.md)

> Tous les fichiers `data/` sont **publics** (versionnés dans un repo GitHub public et servis sur Pages).

---

## 1. Vue d'ensemble

| Fichier | Rôle | Écrit par |
|---------|------|-----------|
| `participants.json` | Catalogue des podcasts suivis | `discover-participants.js` (Pipeline B, complet) · `scrape-votes.js` (clôtures sur actifs) — voir [pipelines.md](pipelines.md) |
| `votes-history.json` | Historique des snapshots de votes | `scrape-votes.js` |
| `meta.json` | Journal du dernier run votes (Pipeline A) | `run-pipeline.js` |
| `sync-report.json` | Rapport de la dernière découverte manuelle (Pipeline B) | `run-discover.js` |
| `execution-journal.log` | Journal d'exécution public (événements + sorties sanitizées) | `run-pipeline.js` · `run-discover.js` |
| `backups/` | Copies horodatées | Tous les scripts avant écriture |

---

## 2. `data/participants.json`

```json
{
  "updatedAt": "2026-06-11T06:00:00+02:00",
  "participants": [
    {
      "slug": "les-filles-aussi-ont-des-ailes",
      "title": "Les filles aussi ont des ailes",
      "url": "https://offre-pedagogique.afd.fr/fr/ressources/les-filles-aussi-ont-des-ailes",
      "school": "Collège de Kawéni 1, Mamoudzou",
      "category": "Cycle 4 (12-14 ans)",
      "academy": "Académie de Mayotte",
      "country": "France",
      "edition": "2026",
      "status": "Demi-finaliste",
      "voteStatus": "open",
      "active": true,
      "firstSeenAt": "2026-06-01T06:00:00+02:00",
      "lastValidatedAt": "2026-06-11T06:00:00+02:00"
    }
  ]
}
```

| Champ | Type | Notes |
|-------|------|-------|
| `slug` | string | Clé primaire AFD, immuable |
| `shareId` | integer | Identifiant court interne pour les liens de partage (`/{shareId}`), assigné à la découverte, immuable |
| `voteStatus` | enum | `open` · `closed` · `unavailable` · `not_eligible` |
| `active` | boolean | `true` seulement si `voteStatus === open` |
| `firstSeenAt` | ISO 8601 | Date de première découverte, jamais modifiée |
| `lastValidatedAt` | ISO 8601 | Dernière visite de la fiche (Pipeline B ou scrape-votes) |

---

## 3. `data/votes-history.json`

```json
{
  "snapshots": [
    {
      "timestamp": "2026-06-11T06:00:00+02:00",
      "entries": [
        { "slug": "les-filles-aussi-ont-des-ailes", "votes": 439 }
      ]
    }
  ]
}
```

- Les snapshots sont **append-only** (jamais de suppression).
- Le rang est calculé à la volée par le front, pas stocké ici.
- Horodatage en fuseau **Europe/Paris** (offset explicite).

---

## 4. `data/meta.json`

Journal du dernier run — affiché dans l'en-tête du site (« Actualisé le… ») et utile au debug.

```json
{
  "lastRunAt": "2026-06-11T06:04:32+02:00",
  "lastRunStatus": "success",
  "lastRunDurationMs": 487000,
  "trigger": "schedule",
  "snapshotTimestamp": "2026-06-11T06:00:00+02:00",
  "counts": {
    "participantsActive": 62,
    "participantsTotal": 78,
    "snapshotsTotal": 14,
    "scrapeErrors": 2,
    "newParticipants": 0
  },
  "errors": [
    {
      "slug": "faim-de-vie",
      "step": "scrape-votes",
      "code": "no_vote_widget",
      "message": "input[data-drupal-selector=edit-likes] absent"
    }
  ]
}
```

| Champ | Description |
|-------|-------------|
| `lastRunStatus` | `running` pendant le job · `success` / `partial` (erreurs mais snapshot créé) / `failed` |
| `trigger` | `schedule` / `manual` / `local` |
| `snapshotTimestamp` | Horodatage du relevé (= début du run, Europe/Paris) |
| `progress` | Pendant `running` : `{ phase, phaseLabel, percent, current, total, slug, elapsedMs, etaMs, errors, listSlugsFound, voteDelta, cumulativeVoteDelta, votes, previousVotes }` — champs votes présents en phase `scrape_votes` |
| `errors` | Max 20 entrées conservées (rotation) |

---

## 5. Backups

Avant chaque écriture, copier vers `data/backups/` :

```
votes-history-2026-06-11-06.json
participants-2026-06-11-06.json
```

- Conserver les **7 derniers jours**, purger automatiquement le reste.
- En cas d'échec d'écriture, ne pas écraser le fichier principal.

---

## 6. Champs optionnels sur `participants`

```json
{
  "slug": "faim-de-vie",
  "edition": null,
  "voteStatus": "unavailable",
  "active": false,
  "scrapeError": "no_vote_widget",
  "lastValidatedAt": "2026-06-11T06:00:00+02:00",
  "lastVotes": null
}
```

| Champ | Description |
|-------|-------------|
| `scrapeError` | Dernier code d'erreur (`no_vote_widget`, `http_429`, `parse_error`) |
| `lastVotes` | Dernier compteur connu (même si le scrape courant a échoué) |

---

## 7. Historique des rapports de découverte

`data/backups/sync-report-YYYY-MM-DD-HH.json` — une copie par run Pipeline B (conservée 30 jours).

---

## 8. `data/sync-report.json`

Produit par Pipeline B. Affiché sur `decouverte.html`.

```json
{
  "status": "complete",
  "runAt": "2026-06-11T14:32:00+02:00",
  "durationMs": 1240000,
  "trigger": "workflow_dispatch",
  "summary": {
    "votesOpened": 2,
    "votesClosed": 1,
    "newlyDiscovered": 3,
    "statusChanged": 0,
    "metadataUpdated": 1,
    "unchanged": 58,
    "errors": 1
  },
  "changes": {
    "votesOpened": [
      {
        "slug": "faim-de-vie",
        "title": "Faim de vie",
        "url": "https://offre-pedagogique.afd.fr/fr/ressources/faim-de-vie",
        "previous": { "active": false, "voteStatus": "unavailable", "edition": null },
        "current": { "active": true, "voteStatus": "open", "edition": "2026", "votes": 12 },
        "reason": "Votes ouverts : édition 2026 confirmée, widget vote détecté (12 votes)"
      }
    ],
    "votesClosed": [
      {
        "slug": "exemple-podcast",
        "title": "Exemple",
        "url": "https://offre-pedagogique.afd.fr/fr/ressources/exemple-podcast",
        "previous": { "active": true, "voteStatus": "open", "votes": 210 },
        "current": { "active": false, "voteStatus": "closed", "votes": 210 },
        "reason": "Votes fermés : texte \"Votes clôturés\" détecté sur la fiche"
      }
    ],
    "newlyDiscovered": [
      {
        "slug": "nouveau-podcast",
        "title": "Nouveau podcast",
        "url": "https://offre-pedagogique.afd.fr/fr/ressources/nouveau-podcast",
        "current": { "active": true, "voteStatus": "open", "edition": "2026", "votes": 0 },
        "reason": "Nouveau slug détecté sur la liste AFD, éligible édition 2026"
      }
    ],
    "statusChanged": [],
    "metadataUpdated": [],
    "unchanged": 58
  },
  "errors": [
    {
      "slug": "podcast-erreur",
      "code": "http_429",
      "message": "Rate limited après 3 tentatives"
    }
  ]
}
```

| Champ | Description |
|-------|-------------|
| `status` | `running` pendant le job · `complete` · `failed` |
| `progress` | Pendant `running` : `{ phase, percent, current, total, slug, elapsedMs, etaMs, errors }` |
| `changes.votesOpened` | `active` passé de `false` à `true` |
| `changes.votesClosed` | `active` passé de `true` à `false` |
| `changes.unchanged` | Nombre de fiches sans changement de statut |

---

## 9. `data/execution-journal.log`

Journal **public** des runs (Pipelines A et B), une ligne par événement. Rétention : **5 jours** (`JOURNAL_RETENTION_DAYS` dans `scripts/lib/constants.js`). Purge automatique au démarrage/fin de run et toutes les 100 lignes.

```
2026-06-11 06:00:05 [pipeline-a] INFO start Démarrage — workflow_dispatch trigger=workflow_dispatch
2026-06-11 06:00:12 [pipeline-a] INFO http_request/fetch GET https://offre-pedagogique.afd.fr/… → 200 (847ms)
2026-06-11 06:05:00 [pipeline-a] INFO step_complete/scrape-votes Scrape terminé — 62 entrée(s) entriesCount=62 scrapeErrors=1
2026-06-11 06:05:30 [pipeline-a] ERROR fail Pipeline interrompu reason=timeout
```

| Segment | Description |
|---------|-------------|
| Horodatage | `YYYY-MM-DD HH:mm:ss` (Europe/Paris) |
| `[pipeline]` | `pipeline-a` (votes) · `pipeline-b` (discover) |
| Niveau | `INFO` · `WARN` · `ERROR` |
| Événement | `start` · `step_complete/…` · `step_error/…` · `http_request/fetch` · `complete` · `fail` |
| Message | Texte lisible ; métadonnées en `clé=valeur` en fin de ligne (sauf requêtes HTTP) |

Sanitisation : `scripts/lib/journal.js` (`sanitizeForJournal`, `sanitizeUrl`) — clés sensibles redacted, chaînes longues tronquées, paramètres URL sensibles masqués.

Chaque requête HTTP sortante (scraping) est journalisée via `scripts/lib/fetcher.js` : console `[http] …` + ligne `http_request` (URL, statut, durée — jamais cookies ni tokens).

Migration : si `execution-journal.json` existe encore, il est converti automatiquement au premier accès.

---

## 10. Règles d'intégrité

1. **Jamais supprimer** un participant ou un snapshot existant.
2. **Merge** à l'ajout : si `slug` existe, mettre à jour les métadonnées uniquement.
3. **Append** pour les snapshots : une nouvelle entrée par run réussi (horodatage = début du run).
4. **Relance** : chaque exécution du pipeline ajoute un snapshot ; seule une collision exacte sur le même `timestamp` (à la seconde) remplace l'entrée existante.
5. **Publication** : `public/data/` est toujours une copie conforme de `data/` après un run réussi.
6. **Découverte** : Pipeline B ne supprime jamais de participant ; les changements sont toujours traçables dans `sync-report.json` et ses backups.
