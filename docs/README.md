# Spécifications — Podium Webradio « Réinventer le monde »

**Projet temporaire** (~quelques semaines) · **Public** · **Édition 2026**

Page web ludique affichant le classement en temps quasi réel des podcasts du [concours Réinventer le monde](https://offre-pedagogique.afd.fr/fr/reinventer-le-monde), avec historique des votes et détection adaptative des hausses suspectes.

---

## Documents

| Document | Contenu |
|----------|---------|
| [Fonctionnel](fonctionnel.md) | Contexte, objectifs, périmètre, décisions, critères d'acceptation |
| [UX / Interface](ux.md) | Design, sections de la page, responsive |
| [Technique](technique.md) | Architecture, hébergement, scripts, scraping, flux opérationnel |
| [Données](donnees.md) | Schémas JSON, backups, champs extraits |
| [Détection d'anomalies](detection-anomalies.md) | Algorithme adaptatif de suspicion (anti-triche) |
| [Planning](planning.md) | Estimation d'effort, risques, hors périmètre |
| [**Repo public**](public-repo.md) | **Règles : rien de privé/confidentiel dans le repo** |

---

## Résumé express

- **Source :** [liste des podcasts AFD](https://offre-pedagogique.afd.fr/fr/publications/liste?type%5B6%5D=6) (édition 2026, votes ouverts)
- **Votes :** mise à jour automatique à 06h et 16h (Europe/Paris)
- **Découverte :** lancement manuel ponctuel + rapport ouvert/fermé sur `/decouverte.html`
- **Stack :** GitHub Actions + GitHub Pages + fichiers JSON
- **Livrable :** classement public + page rapport découverte (également publique)
- **Contrainte :** [repo 100 % public](public-repo.md) — aucun secret ni donnée confidentielle
