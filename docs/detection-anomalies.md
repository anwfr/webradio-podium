# Détection intelligente des votes suspects

[← Index](README.md) · Voir aussi [donnees.md](donnees.md) · [ux.md](ux.md) (affichage)

---

## Principe

Pas de seuils fixes en votes absolus. Les alertes s'adaptent à l'activité réelle du concours et à l'historique propre de chaque participant.

---

## 1. Pipeline

Après chaque snapshot, `detect-alerts.js` :

1. Recalcule les **baselines globales** (tout le concours) et **personnelles** (chaque podcast).
2. Compare le dernier intervalle via des scores statistiques robustes.
3. Produit un **score de suspicion** (0–100) et des alertes en français.

```
votes-history.json
        │
        ▼
  compute-baselines ──→ stats.json
        │
        ▼
  score-anomalies ──→ alerts.json
```

---

## 2. Métriques par intervalle

Calculées entre deux snapshots consécutifs :

| Métrique | Formule | Usage |
|----------|---------|-------|
| `delta` | votesₙ − votesₙ₋₁ | Hausse brute |
| `velocity` | delta / heures_écoulées | Votes par heure |
| `rankJump` | rangₙ₋₁ − rangₙ | Places gagnées (positif = montée) |

### Baselines

| Niveau | Indicateurs | Méthode |
|--------|-------------|---------|
| **Global** | `medianDelta`, `madDelta`, `medianVelocity`, `madVelocity`, `medianRankJump` | Médiane + MAD sur tous les intervalles de tous les participants actifs |
| **Personnel** | idem + `p95Velocity` | Médiane + MAD sur l'historique du participant |

**MAD** (Median Absolute Deviation) = médiane de |xᵢ − médiane|. Robuste face aux outliers.

### Score Z modifié

```
modifiedZ = 0.6745 × (valeur − médiane) / MAD
```

Si MAD = 0 : `modifiedZ = valeur / max(1, médiane)`.

---

## 3. Signaux d'anomalie

Chaque signal produit un sous-score 0–100. Le **score final** est la moyenne pondérée :

| Signal | Poids | Déclenchement | Sous-score |
|--------|-------|---------------|------------|
| **Pic global** | 35 % | `modifiedZGlobal(delta) ≥ seuil` | `min(100, modifiedZ × 15)` |
| **Pic personnel** | 25 % | `modifiedZPersonal(delta) ≥ seuil` | `min(100, modifiedZ × 15)` |
| **Vélocité anormale** | 25 % | `velocity > max(global.p95, personal.p95) × 2` | Ratio vs médiane globale, plafonné à 100 |
| **Saut de rang** | 15 % | `rankJump > global.medianRankJump + 3 × global.madRankJump` | Proportionnel au z-score de rang |

### Seuils de sévérité (score final)

| Score | Sévérité | Affichage |
|-------|----------|-----------|
| ≥ 70 | high | Badge ⚠️ rouge + surbrillance graphique |
| 40–69 | medium | Badge ⚡ orange |
| 20–39 | low | Indicateur discret (tooltip) |
| < 20 | — | Pas d'alerte |

---

## 4. Adaptation au stade du concours

| Phase | Snapshots | Comportement |
|-------|-----------|--------------|
| **Démarrage** | 1–2 | Pas d'alerte — « Historique insuffisant » |
| **Échauffement** | 3–5 | Baseline globale uniquement ; confiance `low` ; seuil Z = **4.5** |
| **Mature** | 6+ | Baselines globale + personnelle ; confiance `medium`/`high` ; seuil Z = **3.5** |
| **Fin de concours** | dernière semaine | Seuil Z = **3.0** |

### Plancher dynamique

```
deltaMin = max(3, round(global.medianDelta × 0.5))
```

Pas d'alerte si `delta < deltaMin`.

---

## 5. Détection de patterns

Analyse des **3 derniers intervalles** :

| Pattern | Condition | Effet |
|---------|-----------|-------|
| **Rafale** | 3 intervalles consécutifs avec `modifiedZGlobal > 2` | +15 points |
| **Accélération** | velocityₙ > velocityₙ₋₁ > velocityₙ₋₂ | +10 points |
| **Isolation** | delta > 5× médiane des autres sur le même intervalle | Pic global forcé à high |

---

## 6. Score persistant

Le score affiché intègre une mémoire courte :

```
suspicionScore = 0.6 × score_dernier_intervalle
               + 0.3 × score_intervalle_précédent
               + 0.1 × score_n-2
```

Décroissance : sans anomalie pendant 3 snapshots → score < 20.

---

## 7. Messages explicatifs

Générés automatiquement, en français :

> « +87 votes en 10h — **6,2× la moyenne du concours** (+14) et **4,1× son habitude** (+21). Ce podcast est dans le top 1 % des hausses de cette période. »

Variables : delta, durée, ratio vs médiane globale, ratio vs médiane personnelle, percentile parmi les pairs.

---

## 8. Faux positifs

Un podcast viral légitimement peut déclencher une alerte. Le score signale une activité **statistiquement inhabituelle**, pas une preuve de triche. Le disclaimer du pied de page le rappelle.
