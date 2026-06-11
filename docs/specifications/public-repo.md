# Contrainte — dépôt GitHub public

[← Index](README.md)

> **Règle absolue :** tout le projet (specs, code, données, historique git) est **public**. Rien de privé ni de confidentiel ne doit y figurer.

---

## 1. Principe

Le repository, le site GitHub Pages et l'historique git sont accessibles à **tout le monde**. Il n'y a :

- **aucune** authentification sur le site ;
- **aucune** page « admin » cachée ;
- **aucun** secret commité dans le repo ;
- **aucune** donnée confidentielle collectée ou stockée.

Ce classement est **non officiel** et agrège des **données déjà publiques** sur le site AFD.

---

## 2. Ce qui est public (volontairement)

| Élément | Visibilité |
|---------|------------|
| `data/*.json` | Public (versionné dans git + servi sur Pages) |
| Historique des votes | Public (chaque commit de snapshot) |
| `decouverte.html` + `sync-report.json` | Public (même niveau que le classement) |
| Workflows GitHub Actions | Public (fichiers `.github/workflows/` visibles) |
| Logs d'erreur dans `meta.json` | Public (pas de stack traces sensibles) |
| `execution-journal.log` | Public (sorties sanitizées, rétention 5 jours) |

---

## 3. Interdictions — ne jamais mettre dans le repo

| Interdit | Raison |
|----------|--------|
| Fichiers `.env`, clés API, tokens, mots de passe | Fuite immédiate sur repo public |
| Personal Access Token (PAT) GitHub | Utiliser uniquement `GITHUB_TOKEN` injecté par Actions |
| URLs « secrètes » avec token en query string | Contournement de sécurité par l'obscurité |
| Données personnelles d'élèves (noms, emails…) | Hors périmètre ; seuls établissements/titres AFD |
| Credentials de proxy ou de bypass anti-bot | Interdit |
| Adresses e-mail ou contacts privés d'organisateurs | Interdit |
| Commentaires « TODO : clé xxx » | Interdit |

---

## 4. Secrets et GitHub Actions

Le **seul** secret utilisé est `GITHUB_TOKEN`, **fourni automatiquement** par GitHub Actions à l'exécution du workflow. Il n'est **jamais** écrit dans le code ni dans les specs sous forme de valeur.

```yaml
# ✅ Correct — token injecté par la plateforme
permissions:
  contents: write
# git push utilise GITHUB_TOKEN implicitement

# ❌ Interdit — PAT dans le repo
# env:
#   GH_TOKEN: ghp_xxxxxxxxxxxx
```

**Lancement manuel des workflows :** réservé aux **collaborateurs** du repo (permission GitHub). Ce n'est pas un mécanisme de sécurité du site — c'est une limite native GitHub. Le rapport de découverte reste **public** une fois généré.

---

## 5. Fichiers à versionner dès l'implémentation

### `.gitignore` (obligatoire)

```
.env
.env.*
*.local
.DS_Store
node_modules/
data/backups/          # option : backups locaux seulement ; si commités, pas de données privées dedans
```

> Les backups **commités** dans `data/backups/` (si choisis) ne contiennent que des copies de données déjà publiques.

### Pas de `.env.example` avec de faux secrets

Si des variables sont un jour nécessaires en local, documenter les noms **sans valeurs** dans ce fichier de specs uniquement.

---

## 6. Code — règles de développement

1. **Aucune constante** du type `API_KEY`, `SECRET`, `TOKEN` dans le code source.
2. **Configuration** : tout est en dur ou en JSON public (pas de config par environnement secrète).
3. **Logs** : pas d'IP utilisateur, pas de cookies, pas de données de navigation — uniquement slugs, codes HTTP, durées.
4. **Scraping** : GET publics uniquement, pas d'authentification AFD.
5. **Front** : pas de `localStorage` pour des tokens ; pas d'appel à une API privée.
6. **Revues** : avant chaque push, vérifier qu'aucun secret n'a été ajouté (`git diff` + grep sur `password|token|secret|api_key`).

---

## 7. Specs — formulation à éviter

| ❌ À ne pas écrire | ✅ Formulation correcte |
|-------------------|------------------------|
| « Page semi-privée » | « Page publique, usage organisateur » |
| « URL secrète » | « Lien GitHub Actions (collaborateurs du repo) » |
| « Mot de passe simple » | Supprimé — pas d'auth |
| « Token dans l'URL » | Supprimé — hors périmètre |
| « Repo public (acceptable ?) » | « Repo public — donnée assumée » |

---

## 8. Données AFD — pas de confidentialité de notre côté

Les informations scrapées sont **déjà publiées** par l'AFD :

- titres de podcasts ;
- noms d'établissements ;
- compteurs de votes ;
- académies, catégories, éditions.

Nous ne collectons rien de plus. Le disclaimer sur le site rappelle la nature non officielle du classement.

---

## 9. Critères d'acceptation (repo public)

- [ ] Aucun fichier `.env` ou credential dans le repo
- [ ] `.gitignore` couvre `.env` et `node_modules`
- [ ] `grep -ri "ghp_\|gho_\|password\s*=\|api_key"` sur le repo → 0 résultat pertinent
- [ ] `decouverte.html` accessible publiquement (pas de garde auth)
- [ ] Specs et code sans mention de secrets à commiter
- [ ] Workflows utilisent uniquement `GITHUB_TOKEN` (pas de PAT)
