# Spécifications — Podium Webradio « Réinventer le monde »

[← Prise en main rapide](../README.md)

**Projet temporaire** (~quelques semaines) · **Public** · **Édition 2026**

Page web ludique affichant le classement en temps quasi réel des podcasts du [concours Réinventer le monde](https://offre-pedagogique.afd.fr/fr/reinventer-le-monde), avec historique des votes.

---

## Documents

| Document | Contenu |
|----------|---------|
| [**Pipelines A et B**](pipelines.md) | **Pourquoi deux pipelines, différences, scénarios, FAQ** |
| [Fonctionnel](fonctionnel.md) | Contexte, objectifs, périmètre, décisions, critères d'acceptation |
| [UX / Interface](ux.md) | Design, sections de la page, responsive |
| [Technique](technique.md) | Architecture, hébergement, scripts, scraping, flux opérationnel |
| [**Déploiement**](deploiement.md) | **Mise en prod GitHub Pages + Actions, cron, dépannage** |
| [Données](donnees.md) | Schémas JSON, backups, champs extraits |
| [Planning](planning.md) | Estimation d'effort, risques, hors périmètre |
| [**Repo public**](public-repo.md) | **Règles : rien de privé/confidentiel dans le repo** |

---

## Résumé express

- **Source :** [liste des podcasts AFD](https://offre-pedagogique.afd.fr/fr/publications/liste?words=&type%5B6%5D=6&thematic%5B389%5D=389&location=) (filtre Edition 2026)
- **Pipelines :** **A** = votes auto sur actifs · **B** = audit complet manuel — [pipelines.md](pipelines.md)
- **Votes :** mise à jour automatique via cron (fréquence configurable, ex. 3×/jour)
- **Stack :** GitHub Actions + GitHub Pages + fichiers JSON
- **Livrable :** classement public (`index.html`)
- **Contrainte :** [repo 100 % public](public-repo.md) — aucun secret ni donnée confidentielle
- **Dev local :** copier `.env.example` → `.env` · `npm run seed-demo` pour des données de démo · `npm run discover` pour le premier peuplement réel
