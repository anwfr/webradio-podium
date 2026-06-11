# Déploiement — GitHub Pages + Actions

[← Prise en main](../README.md) · [Index specs](README.md)

Guide pas à pas pour mettre en ligne le site et configurer la mise à jour automatique des votes.

**Repo exemple :** `https://github.com/{owner}/webradio-podium`  
**URL du site :** `https://{owner}.github.io/webradio-podium/`

---

## Prérequis

- Repo **public** sur GitHub, branche par défaut `main`
- Code poussé sur `main` (front dans `public/`, données dans `data/` et `public/data/`)
- Node.js 20+ en local uniquement pour le dev ; en prod, les workflows tournent sur GitHub

---

## Vue d'ensemble

| Composant | Rôle |
|-----------|------|
| **Deploy site to GitHub Pages** (`pages.yml`) | Publie le dossier `public/` sur GitHub Pages |
| **Discover participants** (`discover.yml`) | Re-scan complet AFD — **manuel**, une fois avant le 1er cron (ou après gros changement catalogue) |
| **Scrape votes** (`scrape.yml`) | Collecte les votes + publish — **cron 2×/jour** + lancement manuel |

Le site statique vit dans `public/`. Les scripts écrivent dans `data/` (source de vérité) puis copient vers `public/data/` via `npm run publish` (appelé par les pipelines).

> **Pourquoi pas « Deploy from branch » + dossier `/public` ?**  
> GitHub Pages n'offre que **`/ (root)`** ou **`/docs`** dans ce mode. Notre `index.html` est dans `public/`, pas à la racine du repo. Le déploiement passe donc par **GitHub Actions** avec `path: public`.

---

## Étape 1 — Pousser le code

```bash
git push origin main
```

Vérifier sur GitHub que le repo contient au minimum :

- `public/index.html`
- `public/data/*.json`
- `.github/workflows/pages.yml`
- `.github/workflows/scrape.yml`
- `.github/workflows/discover.yml`

---

## Étape 2 — Activer GitHub Pages (source Actions)

1. Ouvrir **Settings → Pages** du repo  
   `https://github.com/{owner}/webradio-podium/settings/pages`
2. Section **Build and deployment** → **Source**
3. Choisir **GitHub Actions** (pas « Deploy from a branch »)
4. Enregistrer

Ne pas choisir « Deploy from a branch » avec `/ (root)` : il n'y a pas de `index.html` à la racine du dépôt.

---

## Étape 3 — Permissions Actions (obligatoire)

Les workflows **Scrape votes** et **Discover participants** commitent les JSON sur `main`. Sans permission d'écriture, le push échoue.

1. **Settings → Actions → General**  
   `https://github.com/{owner}/webradio-podium/settings/actions`
2. **Workflow permissions** → cocher **Read and write permissions**
3. **Save**

---

## Étape 4 — Premier déploiement du site

Le workflow **Deploy site to GitHub Pages** se déclenche :

- à chaque push sur `main` modifiant `public/**` ou `.github/workflows/pages.yml`
- manuellement via **Run workflow**

### Lancer manuellement

1. Onglet **Actions**
2. Workflow **Deploy site to GitHub Pages**
3. **Run workflow** → branche `main` → **Run workflow**
4. Attendre le run vert (~1 min)

### Vérifier

- **Settings → Pages** : dernier déploiement réussi
- Site : `https://{owner}.github.io/webradio-podium/`
- Rapport discover (admin) : `https://{owner}.github.io/webradio-podium/decouverte.html`

Au premier déploiement, le front utilise `public/js/site-config.defaults.json` (placeholders GitHub) jusqu’au prochain déploiement Pages, qui génère `site-config.json` à partir de `GITHUB_REPOSITORY`.

---

## Étape 5 — Peuplement initial des données

Deux cas :

### Cas A — Données déjà versionnées sur `main`

Si `data/participants.json` et `public/data/` contiennent déjà les participants (discover fait en local), passer directement à l’**étape 6** (test scrape).

### Cas B — Repo sans participants

1. **Actions → Discover participants**
2. **Run workflow** → `main` → **Run workflow**
3. Durée : ~10–18 min (~180–230 fiches)
4. À la fin : commit `discover: rapport …` sur `main`
5. Le workflow **Deploy site to GitHub Pages** se relance si `public/data/` a changé

---

## Étape 6 — Test du pipeline votes (manuel)

Avant de compter sur le cron :

1. **Actions → Scrape votes**
2. **Run workflow** → `main` → **Run workflow**
3. Durée : ~10–15 min (une fiche par participant actif)
4. Run vert attendu avec commit `data: snapshot …`

Contrôles :

| Où | Attendu |
|----|---------|
| Actions | Steps `Run pipeline` et `Commit and push` en succès |
| Commits | Nouveau snapshot sur `main` |
| Site | Classement visible, footer « Dernière mise à jour : … » |
| Liens GitHub dans le front | Générés au déploiement Pages (`site-config.json`, non versionné) |

---

## Étape 7 — Cron automatique (déjà configuré)

Le fichier `.github/workflows/scrape.yml` contient :

```yaml
on:
  schedule:
    - cron: '0 6,16 * * *'
  workflow_dispatch:
```

### Important : fuseau du cron

GitHub interprète les crons en **UTC**, pas en heure de Paris.

| Cron UTC | Paris (été, UTC+2) | Paris (hiver, UTC+1) |
|----------|--------------------|----------------------|
| 6h | 8h | 7h |
| 16h | 18h | 17h |

Pour viser **6h et 16h heure de Paris en été**, modifier dans `scrape.yml` :

```yaml
schedule:
  - cron: '0 4,14 * * *'
```

Puis commit + push sur `main`.

### Conditions d'exécution

- Le cron ne tourne que sur la branche **par défaut** (`main`)
- Repos inactifs 60 jours : GitHub peut désactiver les crons → relancer un run manuel pour réactiver
- Fréquence recommandée : **2×/jour** (éviter le rate-limit AFD)

---

## Étape 8 — Vérification finale

Checklist prod :

- [ ] **Settings → Pages** : source = GitHub Actions, déploiement OK
- [ ] **Settings → Actions** : Read and write permissions
- [ ] Site accessible sans 404
- [ ] Onboarding établissement au premier visit
- [ ] Onglets Podcasts / Écoles / Mon école fonctionnels
- [ ] Au moins 1 snapshot dans `votes-history.json`
- [ ] Workflow **Scrape votes** : 1 run manuel vert
- [ ] Cron activé (prochain run visible dans l’onglet Actions → Scrape votes → Scheduled)

---

## Workflows — référence rapide

| Workflow | Fichier | Déclenchement | Durée typique |
|----------|---------|---------------|---------------|
| Deploy site to GitHub Pages | `pages.yml` | Push `public/**`, manuel | ~1 min |
| Discover participants | `discover.yml` | Manuel uniquement | ~10–18 min |
| Scrape votes | `scrape.yml` | Cron + manuel | ~10–15 min |

---

## Dépannage

### Pages 404 ou site vide

- Vérifier **Settings → Pages** : source = **GitHub Actions** (pas branch + root)
- Vérifier qu’un run **Deploy site to GitHub Pages** est vert
- Attendre 1–3 min après le déploiement

### « Deploy from branch » ne propose pas `/public`

Comportement normal. Utiliser le workflow `pages.yml` (source Actions).

### Workflow échoue au `git push`

- **Settings → Actions → General** : activer **Read and write permissions**
- Vérifier qu’aucune règle de protection de branche ne bloque `github-actions[bot]`

### Classement vide sur le site

- Lancer **Scrape votes** manuellement
- Vérifier `public/data/participants.json` et `votes-history.json` sur `main`

### Cron ne se déclenche jamais

- Repo inactif → run manuel pour réactiver
- Vérifier que `scrape.yml` est bien sur `main`
- Les crons GitHub peuvent avoir quelques minutes de retard

### Liens GitHub incorrects dans le front

- Relancer **Deploy site to GitHub Pages** (génère `site-config.json` au build)
- Ou lancer `npm run publish` en local avec un `.env` renseigné (fichier gitignoré, usage dev uniquement)

---

## Configuration locale (optionnelle)

Fichier `.env` (non versionné) — voir `.env.example` :

```bash
SITE_BASE_URL=https://webradio.uid.fr
# GITHUB_REPOSITORY=owner/webradio-podium   # optionnel en local
```

Utilisé par `npm run publish` en local. **Sur GitHub Actions**, `GITHUB_REPOSITORY` et `SITE_BASE_URL` sont injectés au build — pas de `.env` nécessaire.

---

## Sécurité

Repo **100 % public** : ne jamais committer `.env`, tokens ou credentials.  
Détails : [public-repo.md](public-repo.md).

---

## Après la mise en prod

- **Votes** : automatiques via cron (Scrape votes)
- **Nouveaux podcasts AFD** : lancer **Discover participants** manuellement, puis laisser le cron reprendre
- **Suivi** : onglet Actions + `decouverte.html` + footer « Dernière mise à jour »
