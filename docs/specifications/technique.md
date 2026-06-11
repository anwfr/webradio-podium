# Spécifications techniques

[← Index](README.md) · Voir aussi [donnees.md](donnees.md)

> **Statut :** spécifications revues le 11/06/2026 après analyse du HTML réel du site AFD (Drupal).

---

## 1. Stack recommandée

| Couche | Choix par défaut | Justification |
|--------|------------------|---------------|
| Runtime scraping | **Node.js 20 LTS** | Un seul écosystème avec le front ; `cheerio` léger et suffisant |
| Parsing HTML | **cheerio** | Site Drupal statique côté rendu, pas besoin de headless browser |
| Front | **HTML / CSS / JS vanilla** | Projet éphémère, zéro build complexe |
| Graphiques | **Chart.js** (CDN) | Simple, suffisant pour courbes multi-séries |
| Hébergement | **GitHub Pages + GitHub Actions** | Gratuit, cron intégré, JSON versionnés |
| Données | **Fichiers JSON** | Pas de BDD ; backups rotatifs |

**Décisions techniques :** voir [§ 14](#14-décisions-techniques).

---

## 2. Architecture

Deux pipelines **séparés** : votes automatiques vs découverte manuelle.

> **Guide détaillé** (pourquoi deux pipelines, ce que chacun fait ou ne fait pas, scénarios) : **[pipelines.md](pipelines.md)**

```
┌─────────────────────────────────────────────────────────────────────┐
│  PIPELINE A — scrape.yml (automatique 06h/16h + manuel optionnel)   │
│                                                                      │
│  scrape-votes → publish-data                                       │
│                                                                      │
│  • Parcourt la liste paginée (filtre édition 2026) pour les NOUVEAUX │
│    slugs uniquement — ne re-visite PAS les fiches inactives          │
│  • Scrape les votes des participants active:true seulement           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PIPELINE B — discover.yml (manuel uniquement — T6)                 │
│                                                                      │
│  discover-participants → diff → sync-report.json → publish-data      │
│                                                                      │
│  • Re-visite TOUTES les fiches connues + nouvelles de la liste       │
│  • Compare état avant/après → rapport détaillé ouvert/fermé        │
│  • Déclenché manuellement via GitHub Actions (collaborateurs repo)   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  GitHub Pages — /public                                              │
│  • index.html          → classement public                           │
│  • decouverte.html     → rapport de la dernière découverte manuelle   │
│  • /data/*.json                                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Pourquoi copier `data/` → `public/data/` ?

GitHub Pages ne sert que `/public`. Les scripts écrivent dans `/data` (source de vérité versionnée) ; le workflow réplique vers `/public/data` pour le site. Évite une config Pages exotique.

---

## 3. Hébergement — GitHub Pages + Actions

### Configuration Pages

Le site est servi depuis le dossier `public/` via le workflow **Deploy site to GitHub Pages** (`.github/workflows/pages.yml`).  
GitHub ne permet pas de choisir `/public` en mode « Deploy from branch » (seuls `/` et `/docs`).

→ Guide complet : **[deploiement.md](deploiement.md)**

```yaml
# Settings → Pages
source: GitHub Actions   # pas « Deploy from branch »
# artifact path: public/  (défini dans pages.yml)
```

### Permissions workflow

```yaml
permissions:
  contents: write   # commit des JSON

concurrency:
  group: scrape
  cancel-in-progress: false   # laisser finir le run en cours
```

### Contraintes GitHub Actions à connaître

| Contrainte | Impact | Mitigation |
|------------|--------|------------|
| Cron non garanti à la minute | Décalage possible de 5–30 min | Acceptable pour ce projet ; afficher l'heure réelle du snapshot |
| Timeout job par défaut 6 h | Suffisant | Limiter à `timeout-minutes: 90` par sécurité |
| IP sortantes partagées (Azure) | Risque rate-limit AFD | Délais aléatoires, retry, volume modéré |
| `GITHUB_TOKEN` push sur même repo | OK pour commit auto | Token injecté par GitHub — **jamais** commité (voir [public-repo.md](public-repo.md)) |

### Alternatives documentées

| Option | Quand l'envisager |
|--------|-------------------|
| Cloudflare Workers + Pages | Si GitHub Actions bloqué par l'AFD (IP Azure) — **sans token dans le repo** |
| Vercel Cron | Si besoin d'un endpoint HTTP — secrets via dashboard hébergeur uniquement, pas dans git |

> **Hors périmètre :** PAT GitHub, tokens dans URL, endpoints protégés par mot de passe, repo privé.

---

## 4. Structure du dépôt

```
webradio-podium/
├── .github/workflows/
│   ├── scrape.yml               # Cron votes 06h/16h
│   └── discover.yml             # Découverte manuelle uniquement
├── docs/
│   ├── README.md            # Prise en main rapide
│   └── specifications/      # Spécifications détaillées
├── scripts/
│   ├── run-pipeline.js          # Pipeline A (votes)
│   ├── run-discover.js          # Pipeline B (découverte + diff)
│   ├── list-scan.js             # Crawl liste paginée (manuel, hors pipeline A)
│   ├── discover-participants.js # Re-visite complète + diff
│   ├── scrape-votes.js
│   ├── publish-data.js
│   └── lib/
│       ├── fetcher.js           # HTTP, anti-bot, retry
│       ├── parser.js            # Sélecteurs Drupal
│       ├── storage.js           # Lecture/écriture JSON atomique
│       ├── constants.js         # Rétention journal, backups, etc.
│       └── journal.js           # Journal d'exécution public
├── data/                        # Source de vérité (versionnée)
│   ├── participants.json
│   ├── votes-history.json
│   ├── meta.json
│   ├── sync-report.json         # Dernier rapport de découverte (Pipeline B)
│   ├── execution-journal.log   # Journal d'exécution (rétention 5 j)
│   └── backups/
├── public/                      # Déployé sur GitHub Pages
│   ├── index.html
│   ├── decouverte.html          # Affiche sync-report.json
│   ├── css/
│   ├── js/
│   └── data/                    # Copie synchronisée depuis data/
├── .gitignore                   # .env, node_modules — voir public-repo.md
├── package.json
└── SPECIFICATIONS.md
```

### Scripts npm

```json
{
  "scripts": {
    "pipeline": "node scripts/run-pipeline.js",
    "discover": "node scripts/run-discover.js",
    "scrape": "node scripts/scrape-votes.js",
    "publish": "node scripts/publish-data.js",
    "seed-demo": "node scripts/seed-demo.js",
    "reset-data": "node scripts/reset-data.js"
  }
}
```

### Configuration locale (`.env` — non versionné)

Copier `.env.example` vers `.env` et renseigner `SITE_BASE_URL` si besoin. Utilisé par les scripts Node pour générer `public/js/site-config.json` (également non versionné — fallback `site-config.defaults.json` sur Pages).

| Variable | Rôle |
|----------|------|
| `SITE_BASE_URL` | URL publique du site |
| `GITHUB_REPOSITORY` | Dépôt `owner/repo` (injecté en Actions ; optionnel en local pour `repoUrl`) |
| `HTTP_TIMEOUT_MS` | Timeout HTTP (défaut **15 s**) |

En GitHub Actions, `GITHUB_REPOSITORY` est injecté automatiquement — pas besoin de `.env`.

### Données par défaut et démo locale

- Au premier run, si `data/*.json` est absent, les scripts créent des **fichiers minimaux vides** (`ensureDataFiles`).
- **`npm run seed-demo`** : peuple `data/` avec un **extrait réaliste** (6 podcasts, 5 snapshots) inspiré de fiches AFD réelles — pour développer le front sans scraper.
- **`npm run reset-data`** : supprime entièrement `data/` et `public/data/` — les JSON vides sont recréés au prochain pipeline.
- **`npm run discover`** : scraping réel complet (Pipeline B) — à lancer avant le premier cron en prod.

---

## 5. Flux opérationnels

### 5.1 Pipeline A — Votes (automatique)

```
[cron 06h/16h Europe/Paris]
        │
        ▼
  run-pipeline.js
        │
        ├─► scrape-votes.js
        │     • visite uniquement participants active:true
        │     • append snapshot (horodatage = début du run)
        │
        └─► publish-data.js → commit + push
```

**Durée estimée :** **4–8 min** (~60–80 fiches actives × 3 s).

### 5.2 Pipeline B — Découverte manuelle (T6)

```
[workflow_dispatch — lancé manuellement par un collaborateur du repo]
        │
        ▼
  run-discover.js
        │
        ├─► 1. Snapshot « avant » de participants.json (en mémoire)
        ├─► 2. Crawl liste complète (filtre édition 2026)
        ├─► 3. Visite CHAQUE fiche (connue + nouvelle)
        ├─► 4. Met à jour participants.json (merge, jamais delete)
        ├─► 5. Calcule le diff avant/après → sync-report.json
        └─► 6. publish-data.js → commit + push
```

**Durée estimée :** **10–18 min** (~180 fiches, délais dans `constants.js`).

**Premier lancement du projet :** exécuter Pipeline B une fois avant le premier cron de votes.

### 5.3 URLs (toutes publiques sauf déclenchement workflow)

| Usage | URL | Visibilité |
|-------|-----|------------|
| Classement | `https://{owner}.github.io/webradio-podium/` | Public |
| Rapport découverte | `https://{owner}.github.io/webradio-podium/decouverte.html` | Public |
| Lancer une découverte | `https://github.com/{owner}/webradio-podium/actions/workflows/discover.yml` | Collaborateurs GitHub uniquement |
| Dev local | `npm run discover` | Machine locale |

> Le **rapport** est public. Seul le **bouton Run workflow** nécessite d'être collaborateur du repo — ce n'est pas une protection du contenu, c'est une limite GitHub. Voir [public-repo.md](public-repo.md).

> Après « Run workflow », attendre ~10–18 min puis rafraîchir `decouverte.html` (auto-refresh 10 s si `status: running`).

---

## 6. Scraping — site source

### URLs

| Usage | URL |
|-------|-----|
| Liste filtrée | `https://offre-pedagogique.afd.fr/fr/publications/liste?words=&type[6]=6&thematic[389]=389&location=&page={n}` |
| Fiche podcast | `https://offre-pedagogique.afd.fr/fr/ressources/{slug}` |

### Pagination Drupal (⚠️ piège)

L'index est **0-based** :

| Affichage site | Paramètre `page` |
|----------------|------------------|
| Page 1 | `page=0` ou absent |
| Page 2 | `page=1` |
| Dernière page | `page=10` (11 pages au total avec filtre édition 2026, juin 2026) |

Filtres URL : `type[6]=6` (podcast concours) + `thematic[389]=389` (programme pédagogique **Edition 2026**).

**Détection du nombre de pages :** lire le lien `fr-pagination__link--last` (pagination dynamique).

### Filtrage édition 2026

Le filtre URL seul ne isole pas l'édition 2026. Règles d'activation :

| Condition | `voteStatus` | `active` |
|-----------|--------------|----------|
| `Edition 2026` + widget vote + pas « Votes clôturés » | `open` | `true` |
| « Votes clôturés » affiché | `closed` | `false` |
| Pas de widget vote (`edit-likes` absent) | `unavailable` | `false` |
| Édition ≠ 2026 ou absente | `not_eligible` | `false` |

**Pipeline A (cron) :** re-visite uniquement les slugs **nouveaux** sur la liste. Les inactifs connus ne sont pas re-scannés.

**Pipeline B (manuel) :** re-visite **toutes** les fiches et produit le diff — voir [§ 15](#15-découverte-manuelle--rapport-de-changements).

---

## 7. Parsing HTML (Drupal)

> Inspecté sur le HTML réel — juin 2026.

### Compteur de votes (priorité décroissante)

| Priorité | Sélecteur | Exemple |
|----------|-----------|---------|
| 1 ⭐ | `input[data-drupal-selector="edit-likes"]` → attribut `value` | `value="439"` |
| 2 | `span.like-num span` (texte interne) | `439` |
| 3 | Regex fallback sur le texte | `Je vote pour ce podcast (N) Likes` |

### Votes clôturés

```html
<p class="flex flex-1 items-center justify-center">Votes clôturés.</p>
```

→ `active: false`, pas de snapshot.

### Édition

Texte libre dans la page, ex. `Edition 2026`. Parser via regex :

```
/Edition\s+(20\d{2})/
```

### Métadonnées fiche

| Champ | Stratégie d'extraction |
|-------|------------------------|
| `title` | `h1` premier |
| `school` | Bloc « Réalisé par… » ou description meta `og:description` en fallback |
| `category` | Regex `catégorie (Cycle \d…\|Lycée…\|Internationale)` |
| `academy` | Texte `Académie de …` |
| `country` | Ligne pays (souvent après catégorie) |
| `status` | « Demi-finaliste », « Lauréat », etc. si présent |

### Cas limites documentés

| Cas | Exemple | Comportement |
|-----|---------|--------------|
| Pas de bouton vote | [faim-de-vie](https://offre-pedagogique.afd.fr/fr/ressources/faim-de-vie) (juin 2026) | `votes: null`, `scrapeError: "no_vote_widget"` ; conserver dernière valeur si existante ; exclure du classement actif |
| Pas d'édition affichée | idem | `edition: null` → `active: false` jusqu'à résolution |
| Template partiel | Fiches sans bloc `podcast-card__likes` | Logger + flag dans `meta.json` |
| HTTP 429/503 | Rate limit | Retry backoff 30s → 60s → 120s, max 3 |
| HTTP 404 | Fiche supprimée | `active: false`, conserver historique |

### Headless browser ?

**Non requis.** Le compteur de votes est dans le HTML initial (`input hidden`). Pas de rendu JS nécessaire pour lire les likes. Playwright/Puppeteer = plus lent, plus lourd, plus détectable.

---

## 8. Scripts — Pipeline A (`scrape-votes`)

### `list-scan.js` (hors pipeline automatique)

Script conservé pour usage manuel si besoin. Le cron Pipeline A ne l'appelle plus : la liste AFD est considérée figée. Pour resynchroniser le catalogue, lancer Pipeline B.

### `scrape-votes.js`

1. Parcourt `participants.json` où `active: true`.
2. Extrait le compteur via `input[data-drupal-selector="edit-likes"]`.
3. Si « Votes clôturés » détecté : `active: false`, `voteStatus: closed`, pas de snapshot.
4. Append dans `votes-history.json` (un snapshot par run, horodaté à l'instant du début).

---

## 9. Scripts — Pipeline B (`discover-participants`)

**Rôle :** re-validation complète + rapport de changements (`sync-report.json`).

```
1. before ← copie participants.json
2. Crawl liste (filtre édition 2026)
3. Visite TOUTES les fiches (connues + nouvelles)
4. Merge participants.json (jamais delete)
5. after ← participants.json mis à jour
6. Diff before/after → sync-report.json
```

| Changement | Section rapport |
|------------|-----------------|
| `active: false → true` | `votesOpened` 🟢 |
| `active: true → false` | `votesClosed` 🔴 |
| `voteStatus` modifié sans bascule `active` | `statusChanged` |
| Slug absent de `before` | `newlyDiscovered` |
| Titre / école / catégorie modifiés | `metadataUpdated` |
| Rien | compteur `unchanged` |

Chaque entrée : `slug`, `title`, `url`, `previous`, `current`, `reason` (phrase en français).

**Exemples de `reason` :**
- « Votes ouverts : édition 2026 confirmée, widget vote détecté (12 votes) »
- « Votes fermés : "Votes clôturés" apparu sur la fiche »
- « Indisponible : widget vote absent (était ouvert précédemment) »

Schéma JSON : [donnees.md § 10](donnees.md#10-datasync-reportjson).

Au démarrage : `sync-report.json` passe à `status: running`. À la fin : `status: complete`.

---

## 10. Anti-détection bot

| Mesure | Détail |
|--------|--------|
| User-Agent | Pool de 10 UA récents, 1 UA par run (cohérent sur toute l'exécution) |
| Headers | `Accept`, `Accept-Language: fr-FR,fr;q=0.9`, `Accept-Encoding: gzip, deflate, br`, `Referer` chaîné (liste → fiche), `Sec-Fetch-Dest: document`, `Sec-Fetch-Mode: navigate`, `Sec-Fetch-Site: same-origin` |
| Délais | `random(1000, 3000)` ms entre fiches ; `random(2500, 6000)` ms entre pages liste (`constants.js`) |
| Session | `fetch` avec cookie jar (`tough-cookie` ou équivalent) |
| Retry | Backoff exponentiel sur 429/503/timeout |
| Parallélisme | **Aucun** — séquentiel strict |
| Compression | Accepter gzip/br |
| Volume Pipeline A | ~80 fiches actives × 2/jour ≈ **~160 req/jour** |
| Volume Pipeline B | ~180 fiches en une fois, lancement manuel ponctuel |

**Note :** le site utilise `antibot` sur le **formulaire de vote** (POST). Nous ne faisons que des **GET** de lecture — pas d'interaction avec le formulaire `like-form`.

---

## 11. Gestion des erreurs et résilience

### Stratégie par fiche

```
try fetch + parse
  → succès : mettre à jour
  → échec   : logger, incrémenter errorCount, conserver valeurs précédentes
```

Un échec isolé **ne bloque pas** le pipeline.

### Snapshots — un relevé par run

Chaque exécution du pipeline crée un snapshot horodaté à l'**instant de début du run** (Europe/Paris, précision à la seconde). Relancer le pipeline autant de fois que souhaité enrichit l'historique — la fréquence du cron (`scrape.yml`) est indépendante de l'horodatage.

En cas de collision exacte sur le même `timestamp` (relance dans la même seconde), le snapshot existant est **remplacé** plutôt que dupliqué.

### Écriture atomique

```javascript
// storage.js
writeJson(path, data) {
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, path);   // atomic on same filesystem
}
```

### Fichier `meta.json` (nouveau)

Journal de chaque run — voir [donnees.md](donnees.md#8-data-metajson).

---

## 12. Workflows GitHub Actions

### 12.1 `scrape.yml` — votes automatiques

```yaml
name: Scrape votes

on:
  schedule:
    - cron: '0 6,16 * * *'
  workflow_dispatch:

env:
  TZ: Europe/Paris

permissions:
  contents: write

concurrency:
  group: scrape
  cancel-in-progress: false

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 90

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci

      - name: Run pipeline
        run: npm run pipeline

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/ public/data/
          if git diff --staged --quiet; then
            echo "No changes"
          else
            git commit -m "data: snapshot $(date +%Y-%m-%d_%H-%M)"
            git push
          fi
```

### 12.2 `discover.yml` — découverte manuelle

```yaml
name: Discover participants

on:
  workflow_dispatch:    # Manuel uniquement — pas de cron

permissions:
  contents: write

concurrency:
  group: discover
  cancel-in-progress: false

jobs:
  discover:
    runs-on: ubuntu-latest
    timeout-minutes: 90

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm run discover
      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/ public/data/
          git commit -m "discover: rapport $(date +%Y-%m-%d_%H-%M)" || echo "No changes"
          git push
```

---

## 13. Front — chargement des données

```javascript
// public/js/data.js
const [participants, history, meta] = await Promise.all([
  fetch('/data/participants.json').then(r => r.json()),
  fetch('/data/votes-history.json').then(r => r.json()),
  fetch('/data/meta.json').then(r => r.json()),
]);
```

- **Pas de cache busting** nécessaire : le commit change les fichiers, GitHub Pages invalide.
- **Calculs côté client :** rang, Δ rang, Δ votes (à partir des 2 derniers snapshots).
- **Pas de framework** : `index.html` + `decouverte.html`, ~4–6 modules JS.

### Page `decouverte.html`

- Charge `/data/sync-report.json`.
- Sections visuelles : **Votes ouverts** (vert), **Votes fermés** (rouge), **Nouveaux**, **Métadonnées mises à jour**, **Inchangés** (replié).
- Chaque ligne : titre, slug, avant → après, raison, lien AFD.
- Bandeau avec date du run + lien « Lancer une nouvelle découverte » (→ GitHub Actions).
- Si `status: running` : spinner + auto-refresh 30 s.

---

## 14. Décisions techniques

### Validées ✅

| # | Sujet | Décision |
|---|-------|----------|
| T1 | Langage scraping | **Node.js 20** + cheerio |
| T2 | Front | **Vanilla HTML/CSS/JS** (pas de build) |
| T3 | Visibilité repo | **Public** — rien de confidentiel (voir [public-repo.md](public-repo.md)) |
| T5 | Graphiques | **Chart.js** (CDN) |
| T6 | Re-visite des inactifs | **Pipeline B manuel** + page `decouverte.html` avec diff détaillé |

### En attente / par défaut

| # | Sujet | Proposition |
|---|-------|-------------|
| T4 | URL du site | `*.github.io/webradio-podium` — configurable via `.env` |
| T7 | Timeout HTTP par fiche | **15 s** (`HTTP_TIMEOUT_MS`) |

---

## 15. Découverte manuelle — rapport de changements

Voir schéma `sync-report.json` dans [donnees.md](donnees.md#10-datasync-reportjson).

**Principe :** à chaque lancement manuel, un rapport **public** exhaustif est généré et listé sur `decouverte.html` :
- quels podcasts **viennent d'ouvrir** au vote public ;
- quels podcasts **viennent de fermer** ;
- quels podcasts sont **nouveaux** dans notre base ;
- ce qui n'a **pas changé** (compteur uniquement, section repliée).

Les runs automatiques 06h/16h **ne modifient pas** le statut des inactifs connus — seul Pipeline B le fait. Tableau comparatif et FAQ : [pipelines.md](pipelines.md).

---

## 16. Sécurité, conformité et repo public

Contraintes détaillées : **[public-repo.md](public-repo.md)**.

| Point | Position |
|-------|----------|
| Repo | **100 % public** — specs, code, JSON, historique git |
| Secrets | **Aucun** dans le repo ; `GITHUB_TOKEN` injecté par Actions uniquement |
| Scraping | Lecture seule de données publiques AFD ; pas de vote automatisé |
| `robots.txt` | Vérifier avant mise en prod ; respecter si interdit |
| Données stockées | Titres, établissements, votes — déjà publics sur AFD ; pas de données élèves |
| Pages | `index.html` et `decouverte.html` accessibles sans authentification |
| Rate limiting | Comportement courtois (délais, volume limité) |

---

## 17. Observabilité

| Mécanisme | Détail |
|-----------|--------|
| `meta.json` | Statut du dernier run votes (Pipeline A) |
| `sync-report.json` | Rapport du dernier run découverte (Pipeline B) |
| `execution-journal.log` | Historique des runs (5 j) — événements + sorties sanitizées |
| Logs GitHub Actions | Conservés 90 jours |
| Artifacts (optionnel) | Upload `data/backups/` en artifact si run échoue |
| Badge README (optionnel) | « Dernier scrape : OK/KO » via shield.io |

---

## 18. Critères techniques d'acceptation

**Pipeline A (votes)**
- [ ] `npm run pipeline` exécutable en local
- [ ] Cron 06h/16h ne re-visite pas les fiches inactives connues
- [ ] Nouveaux slugs sur la liste détectés et intégrés automatiquement
- [ ] Relance même jour = pas de snapshot doublon

**Pipeline B (découverte)**
- [ ] `npm run discover` + workflow `discover.yml` fonctionnels
- [ ] `sync-report.json` liste précisément ouverts / fermés / nouveaux
- [ ] `decouverte.html` affiche le rapport de façon lisible
- [ ] URL GitHub Actions documentée et bookmarkable

**Commun**
- [ ] Pagination 0-based (nombre de pages lu depuis la liste filtrée)
- [ ] Votes via `input[data-drupal-selector="edit-likes"]`
- [ ] `public/data/` synchronisé après chaque run réussi
- [ ] Durée Pipeline A < 15 min ; Pipeline B < 90 min
- [ ] Aucun secret ni donnée confidentielle dans le repo ([public-repo.md](public-repo.md))
