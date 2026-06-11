# Modèle de données

[← Index](README.md) · Voir aussi [technique.md](technique.md) · [public-repo.md](public-repo.md)

> Tous les fichiers `data/` sont **publics** (versionnés dans un repo GitHub public et servis sur Pages).

---

## 1. Vue d'ensemble

| Fichier | Rôle | Écrit par |
|---------|------|-----------|
| `participants.json` | Catalogue des podcasts suivis | `sync-participants.js` |
| `votes-history.json` | Historique des snapshots de votes | `scrape-votes.js` |
| `stats.json` | Baselines statistiques (globales + par participant) | `detect-alerts.js` |
| `alerts.json` | Alertes et scores de suspicion | `detect-alerts.js` |
| `meta.json` | Journal du dernier run votes (Pipeline A) | `run-pipeline.js` |
| `sync-report.json` | Rapport de la dernière découverte manuelle (Pipeline B) | `run-discover.js` |
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
| `slug` | string | Clé primaire, immuable |
| `voteStatus` | enum | `open` · `closed` · `unavailable` · `not_eligible` |
| `active` | boolean | `true` seulement si `voteStatus === open` |
| `firstSeenAt` | ISO 8601 | Date de première découverte, jamais modifiée |
| `lastValidatedAt` | ISO 8601 | Dernière visite de la fiche (Pipeline B ou list-scan) |

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
- Le rang est calculé à la volée par le front ou par `detect-alerts.js`, pas stocké ici.
- Horodatage en fuseau **Europe/Paris** (offset explicite).

---

## 4. `data/stats.json`

Baselines recalculées à chaque cycle. Consommées par le front pour le bandeau « N relevés » et par `anomaly-detector.js`.

```json
{
  "generatedAt": "2026-06-11T16:00:00+02:00",
  "snapshotCount": 14,
  "global": {
    "medianDelta": 8,
    "madDelta": 4,
    "medianVelocity": 0.8,
    "madVelocity": 0.3,
    "medianRankJump": 1,
    "participantCount": 62
  },
  "participants": {
    "les-filles-aussi-ont-des-ailes": {
      "historyLength": 14,
      "medianDelta": 6,
      "madDelta": 2,
      "medianVelocity": 0.6,
      "p95Velocity": 1.4
    }
  }
}
```

---

## 5. `data/alerts.json`

```json
{
  "generatedAt": "2026-06-11T16:00:00+02:00",
  "modelVersion": "adaptive-v1",
  "alerts": [
    {
      "slug": "exemple-podcast",
      "type": "anomaly_spike",
      "severity": "high",
      "suspicionScore": 87,
      "confidence": "high",
      "message": "+87 votes en 10h — 6,2× la médiane du concours (+14) et 4,1× sa moyenne habituelle (+21)",
      "votesDelta": 87,
      "periodHours": 10,
      "metrics": {
        "modifiedZGlobal": 5.2,
        "modifiedZPersonal": 4.8,
        "percentileAmongPeers": 99,
        "velocity": 8.7,
        "velocityRatioVsGlobal": 10.9
      }
    }
  ],
  "suspicionScores": {
    "exemple-podcast": 87,
    "autre-podcast": 12
  }
}
```

| Champ | Description |
|-------|-------------|
| `modelVersion` | Version de l'algorithme (permet d'invalider l'historique si changement majeur) |
| `confidence` | `low` / `medium` / `high` — selon la phase du concours |
| `suspicionScores` | Map slug → score persistant (avec mémoire sur 3 intervalles) |

---

## 6. `data/meta.json`

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
| `lastRunStatus` | `success` / `partial` (erreurs mais snapshot créé) / `failed` |
| `trigger` | `schedule` / `manual` / `local` |
| `snapshotTimestamp` | Horodatage arrondi du snapshot (identifiant d'idempotence) |
| `errors` | Max 20 entrées conservées (rotation) |

---

## 7. Backups

Avant chaque écriture, copier vers `data/backups/` :

```
votes-history-2026-06-11-06.json
participants-2026-06-11-06.json
```

- Conserver les **7 derniers jours**, purger automatiquement le reste.
- En cas d'échec d'écriture, ne pas écraser le fichier principal.

---

## 8. Champs optionnels sur `participants`

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

## 9. Historique des rapports de découverte

`data/backups/sync-report-YYYY-MM-DD-HH.json` — une copie par run Pipeline B (conservée 30 jours).

---

## 10. `data/sync-report.json`

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
| `changes.votesOpened` | `active` passé de `false` à `true` |
| `changes.votesClosed` | `active` passé de `true` à `false` |
| `changes.unchanged` | Nombre de fiches sans changement de statut |

---

## 11. Règles d'intégrité

1. **Jamais supprimer** un participant ou un snapshot existant.
2. **Merge** à l'ajout : si `slug` existe, mettre à jour les métadonnées uniquement.
3. **Append** pour les snapshots : une nouvelle entrée par cycle réussi.
4. **Idempotence** : relancer un script sur le même cycle ne crée pas de doublon — clé = `snapshotTimestamp` dans `meta.json`.
5. **Publication** : `public/data/` est toujours une copie conforme de `data/` après un run réussi.
6. **Découverte** : Pipeline B ne supprime jamais de participant ; les changements sont toujours traçables dans `sync-report.json` et ses backups.
