# Podium — Réinventer le monde 2026

Classement public des votes du [concours de podcasts AFD](https://offre-pedagogique.afd.fr/fr/reinventer-le-monde) : podium, historique et alertes de votes suspects.

**Site** : classement public (`index.html`) · **Stack** : Node 20, JSON, GitHub Pages + Actions.

---

## Démarrage rapide (5 min)

**Prérequis** : Node.js 20+

```bash
cp .env.example .env
# Éditer GITHUB_OWNER et GITHUB_REPO dans .env

npm install
npm run seed-demo    # données de démo (sans scraper l'AFD)
npm run dev
```

Ouvrir http://localhost:3000

Sans `seed-demo`, les scripts créent des fichiers JSON vides au premier lancement.

---

## Commandes utiles

| Commande | Usage |
|----------|--------|
| `npm run dev` | Serveur local http://localhost:3000 |
| `npm run seed-demo` | Données fictives réalistes pour le front |
| `npm run reset-data` | Supprime entièrement `data/` et `public/data/` |
| `npm run pipeline` | Pipeline A : votes → alertes → publish |
| `npm run discover` | Pipeline B : re-validation complète (~10–18 min) |
| `npm run publish` | Copie `data/` → `public/data/` + `site-config.json` |

Les pipelines écrivent un journal public dans `data/execution-journal.log` (rétention 5 jours, sans données sensibles).

**Pipeline A vs B** (rôles respectifs, ce que chacun fait ou ne fait pas) → **[specifications/pipelines.md](specifications/pipelines.md)**

### Progression Pipeline A (local)

Comme Pipeline B, le cron votes affiche en console une barre de progression (`[pipeline] …`) et met à jour `meta.json` pendant l'exécution (`lastRunStatus: running`, champ `progress`). Suivre en parallèle avec `npm run dev` via le JSON `data/meta.json` (recopié dans `public/data/` toutes les ~3 fiches).

---

## Découverte réelle des participants (local)

Équivalent local du workflow GitHub [**Discover participants**](https://github.com/{owner}/webradio-podium/actions/workflows/discover.yml) : re-parcourt la liste AFD, visite **toutes** les fiches (connues + nouvelles), met à jour `participants.json` et génère le rapport `sync-report.json`.

**Durée** : ~10–18 min (~180 fiches, délais anti-rate-limit). **À lancer une fois** avant le premier cron de votes en prod.

### Prérequis

```bash
npm install
cp .env.example .env   # optionnel : liens GitHub dans le front après publish
```

### Lancer

```bash
PIPELINE_TRIGGER=local npm run discover
```

(`PIPELINE_TRIGGER` est journalisé dans `meta.json` et `execution-journal.log` — en Actions la valeur est `workflow_dispatch`.)

### Pendant l'exécution

- **Console** : barre de progression, %, ETA et slug courant (`[discover] [████░░…] 12/180 (7%) …`).
- **Chaque requête HTTP** est loggée (`[http] GET …`) dans la console et le journal.
- **`sync-report.json`** : champ `progress` mis à jour en continu (`phase`, `percent`, `etaMs`, etc.).
- **Page web** : lancer en parallèle `npm run dev` pour suivre la progression sur `decouverte.html` (URL admin, refresh auto 10 s).
- **Journal** : `data/execution-journal.log` (événements + requêtes sortantes).

**Anti-flood** : délais aléatoires entre requêtes, referer chaîné, session cookies, pause longue après 429, retry avec backoff — constantes dans `scripts/lib/constants.js`.

### Après l'exécution

```bash
npm run publish          # si besoin : recopie data/ → public/data/
npm run dev
```

- Classement : http://localhost:3000
- JSON : `data/sync-report.json`, `data/participants.json`

Pour versionner les résultats (comme le bot Actions) :

```bash
git add data/ public/data/ public/js/site-config.json
git commit -m "discover: rapport $(date +%Y-%m-%d_%H-%M)"
git push
```

**Ne pas committer** `.env` ni secrets.

---

## Mise en ligne (GitHub)

Guide pas à pas complet : **[specifications/deploiement.md](specifications/deploiement.md)** (Pages via Actions, discover, cron votes, dépannage).

Résumé :

1. Pousser le repo sur GitHub (public).
2. **Settings → Pages** : source **GitHub Actions** (le site est dans `public/`, pas à la racine).
3. **Settings → Actions** : **Read and write permissions**.
4. Lancer **Deploy site to GitHub Pages**, puis **Scrape votes** (ou **Discover** si catalogue vide).
5. Cron votes : 2×/jour par défaut (`scrape.yml` — horaires en UTC, voir doc déploiement).

En Actions, `GITHUB_REPOSITORY` suffit — pas besoin de `.env` sur le serveur.

---

## Structure du dépôt

```
public/           Site statique (Pages) + data/ synchronisée
data/             Source de vérité JSON (versionnée)
scripts/          Scraping, détection, pipelines
.github/workflows scrape.yml (cron) · discover.yml (manuel)
```

---

## Configuration locale

Fichier **`.env`** (non versionné) — voir `.env.example` :

- `GITHUB_OWNER` / `GITHUB_REPO` — liens GitHub dans le front
- `HTTP_TIMEOUT_MS` — optionnel (défaut 15 s)

Le front lit `public/js/site-config.json` (généré par `publish`, gitignored) ou `site-config.defaults.json`.

---

## Règle importante

Repo **100 % public** : pas de secrets, tokens ni données confidentielles dans git. Détails → [public-repo.md](specifications/public-repo.md).

---

## Spécifications complètes

Index des specs détaillées (fonctionnel, technique, UX, données, etc.) : **[specifications/](specifications/README.md)**
