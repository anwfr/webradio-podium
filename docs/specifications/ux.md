# Spécifications UX / Interface

[← Index](README.md) · Voir aussi [fonctionnel.md](fonctionnel.md)

---

## 1. Ton et style

- **Public cible :** collégiens / lycéens (usage mobile prioritaire) + organisateurs
- **Ambiance :** moderne, fun, coloré — **pas institutionnel ni ringard**
- **Palette :** couleurs vives (corail, turquoise, violet), dégradés, coins arrondis
- **Typo :** Nunito (Google Fonts)
- **Layout :** mobile-first, frame centrée ~480px sur desktop (même expérience que sur téléphone)

---

## 2. Parcours principal (`index.html`)

### Onboarding (obligatoire)

Au premier visit sur `/`, l'utilisateur doit choisir son établissement :

- Écran plein page avec recherche texte
- Liste en cartes (nom de l'établissement)
- Bouton « C'est mon établissement » — pas de skip
- Persistance `localStorage` (`webradio-podium-user-establishment`)
- Exception : liens directs `/etablissement/{key}` (consultation sans onboarding)

Changement d'établissement : bouton « Changer » dans l'en-tête de l'onglet Mon école.

### Navigation (barre d'onglets en bas)

| Onglet | Contenu |
|--------|---------|
| **Mon école** | Podium local (top 3) + liste des podcasts de l'établissement choisi ; en-tête avec nom de l'établissement |
| **Podcasts** | Toggle En 24 h / Au général, badges fun (En feu, Champion…), podium global (top 3) + classement complet en cartes + recherche |
| **Écoles** | Compteur global 24 h, badges fun, toggle En 24 h / Au général, mini-podium top 3 écoles, voisinage de mon établissement (2 avant / 2 après) |

Hash optionnel : `#mon-ecole`, `#podcasts` (anciens `#podium` et `#classement` redirigés), `#ecoles`.

### Listes

- **Cartes podcast** (pas de tableau) : rang, titre, votes, delta 24 h, chip établissement (mode global)
- En mode établissement : rang local + indication `#N global`
- Clic sur carte → détail podcast (sheet plein écran)

### Podium

- Une ligne : 2e · 1er · 3e avec marches (hauteur or / argent / bronze)
- Carte : médaille, titre, votes, variation 24 h ; chip établissement sur le podium global seulement

### Détail podcast (sheet plein écran)

- Rang global, votes, deltas 24 h
- Piste de position au classement global
- Voisins du **classement global** (toujours basé sur tous les podcasts actifs)
- Voisins du classement de l'établissement (si 2+ podcasts)
- **Graphiques** : évolution des votes et du rang (Chart.js) — uniquement ici
- Partage lien, lien AFD

### Pied de page

- Disclaimer court + liens AFD et GitHub

### Affichage alertes / fraude

**Hors périmètre UI actuel.** Le pipeline continue de générer `alerts.json` ; aucun badge, colonne ou marqueur graphique n'est affiché pour l'instant.

---

## 3. Vue établissement partagée (`/etablissement/{key}`)

- Même contenu que l'onglet Mon école pour l'établissement de l'URL
- Pas d'onboarding, pas de barre d'onglets
- Lien « Retour » vers l'app principale

---

## 4. Page `decouverte.html`

Page séparée, non modifiée par la refonte mobile. Voir section précédente du spec pour le rapport de découverte.

---

## 5. Responsive

| Viewport | Adaptations |
|----------|-------------|
| Mobile | Layout par défaut ; safe areas ; zones tactiles ≥ 44px |
| Desktop | Frame mobile centrée, max ~480px |

---

## 6. États particuliers

| État | Affichage |
|------|-----------|
| Chargement initial | Spinner |
| Données vides | Carte « Le podium se prépare… » |
| Erreur JSON | Message + bouton recharger |
| Établissement introuvable | Message + lien retour |
