# Planning, risques et hors périmètre

[← Index](README.md)

---

## 1. Estimation d'effort

| Tâche | Durée estimée |
|-------|---------------|
| Scripts scraping + parser (sélecteurs Drupal) | 5–7 h |
| Pipeline B découverte + decouverte.html | 3–4 h |
| Workflow GitHub Actions | 1 h |
| Front (podium + tableau + graphique) | 6–8 h |
| Détection adaptative (anomaly-detector) | 3–4 h |
| Tests & ajustements | 2–3 h |
| **Total** | **~2 jours** |

---

## 2. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Blocage IP / rate-limit (IP Azure GH Actions) | Scraping interrompu | Délais aléatoires, rotation UA, volume faible ; fallback Cloudflare Worker |
| Fiches sans widget vote (template partiel) | Trous dans le classement | Flag `no_vote_widget`, exclusion du classement actif, log dans meta.json |
| Pagination Drupal 0-based | Pages manquantes si mal parsée | Lire le lien `pagination--last`, tester sur 13 pages |
| Changement structure HTML | Données non parsées | Parser tolérant + logs ; alerte si 0 votes parsés |
| Fiches sans compteur visible | Trou dans l'historique | Logger + conserver dernière valeur connue |
| GitHub Actions indisponible | Pas de mise à jour | `workflow_dispatch` manuel en secours |
| Nouveau participant en cours de vote | Retard de suivi | Détecté au prochain cycle (max ~12 h) |
| Faux positifs sur alertes | Confusion organisateurs | Disclaimer + messages explicatifs + score gradué |

---

## 3. Hors périmètre

- Vote directement depuis notre page
- Authentification, espace admin, pages « privées »
- Secrets, tokens ou credentials dans le repo ([public-repo.md](public-repo.md))
- URLs protégées par mot de passe ou token
- Notifications push / email
- Application mobile native
- Suivi des éditions 2024/2025 (votes clôturés)
- Interface d'administration des seuils d'alerte
- Export CSV / API publique
- Repo privé ou données confidentielles

---

## 4. Jalons suggérés

| Jalon | Livrable |
|-------|----------|
| J1 matin | Scripts scraping fonctionnels + premier JSON peuplé |
| J1 après-midi | Workflow GitHub Actions + détection anomalies |
| J2 matin | Front podium + tableau |
| J2 après-midi | Graphique + polish UX + tests sur une semaine |
