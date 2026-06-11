# Spécifications UX / Interface

[← Index](README.md) · Voir aussi [fonctionnel.md](fonctionnel.md) · [detection-anomalies.md](detection-anomalies.md) (affichage des alertes)

---

## 1. Ton et style

- **Public cible :** collégiens / lycéens + organisateurs
- **Ambiance :** moderne, fun, coloré — **pas institutionnel ni ringard**
- **Palette :** couleurs vives (corail, turquoise, violet), dégradés, coins arrondis
- **Typo :** sans-serif moderne (ex. Nunito, Poppins via Google Fonts)
- **Animations légères :** confettis subtils sur le podium, transitions au scroll

---

## 2. Sections de la page

### En-tête

- Titre : « 🎙️ Podium — Prix du public Réinventer le monde 2026 »
- Sous-titre : dernière mise à jour (ex. « Actualisé le 11 juin à 16h »)
- Bandeau info : « Basé sur N relevés — seuils adaptatifs »
- Lien vers le site AFD officiel

### Podium (top 3)

- Visuel de **podium 3 marches** (🥇 or, 🥈 argent, 🥉 bronze)
- Carte par participant : titre, école, nombre de votes, variation depuis le dernier relevé
- Clic sur une carte → scroll vers la ligne correspondante dans le tableau

### Tableau complet

| Colonne | Description |
|---------|-------------|
| Rang | Position actuelle |
| Δ rang | Variation depuis le relevé précédent |
| Titre | Nom du podcast (lien AFD) |
| École / Académie | Établissement et académie |
| Catégorie | Cycle 3 / 4 / Lycée |
| Votes | Total actuel |
| Δ votes | Variation depuis le relevé précédent |
| Suspicion | Jauge colorée 0–100 + icône si ≥ 40 |
| Alerte | Badge si anomalie détectée |

**Interactions :**
- Tri par défaut : votes décroissants
- Recherche / filtre texte libre
- Filtre par catégorie (Cycle 3 / 4 / Lycée)
- Filtre rapide : « Afficher les suspects (score ≥ 40) »

### Graphique d'évolution

- Graphique en lignes (Chart.js ou Apache ECharts)
- Une courbe par participant (couleurs distinctes)
- **Sélecteur multi-participants** (checkbox ou recherche) — max 10 courbes simultanées
- Axe X : dates/heures des snapshots
- Axe Y : nombre de votes
- Points d'alerte marqués en rouge sur les intervalles flaggés
- Zone ombrée en cas de rafale détectée
- Mode « comparer le top 5 » en un clic

### Tooltips alertes

Au survol ou clic sur une alerte :
- Message explicatif en français (ex. « 6,2× la moyenne du concours »)
- Métriques brutes (Z-score, vélocité, percentile)

### Pied de page

- Disclaimer : « Classement non officiel, basé sur le scraping public des votes AFD. Un score de suspicion élevé signale une activité inhabituelle, pas une preuve de triche. »
- Lien vers `decouverte.html` (rapport de découverte, page publique)
- Crédits / lien GitHub

---

## 3. Page `decouverte.html` (rapport de découverte)

Page publique (pas d'authentification), séparée du classement, dédiée au **rapport de la dernière découverte manuelle**. Contenu non confidentiel — mêmes données que les JSON versionnés dans le repo.

### En-tête

- Titre : « 🔍 Découverte des participants »
- Date/heure du dernier run + durée
- État : `En cours…` (spinner) / `Terminé` / `Échec`
- Bouton **« Lancer une nouvelle découverte »** → lien GitHub Actions (`discover.yml`)

### Sections (dans l'ordre)

| Section | Style | Contenu |
|---------|-------|---------|
| **Votes ouverts** | Vert, icône ✅ | Liste des podcasts passés inactif → actif ; avant/après ; raison |
| **Votes fermés** | Rouge, icône 🛑 | Liste des podcasts passés actif → inactif ; raison |
| **Nouveaux podcasts** | Bleu, icône 🆕 | Slugs jamais vus auparavant |
| **Métadonnées mises à jour** | Neutre | Titre, école, catégorie modifiés (statut inchangé) |
| **Inchangés** | Replié par défaut | « 58 fiches sans changement » — clic pour déplier la liste |

Chaque ligne : titre (lien AFD), badge `voteStatus`, détail `previous → current`, phrase `reason`.

### Comportement

- Auto-refresh toutes les 30 s si `status: running`
- Message si aucun rapport : « Aucune découverte lancée — cliquez sur le bouton ci-dessus »
- Lien retour vers le classement (`index.html`)

---

## 4. Responsive

| Viewport | Adaptations |
|----------|-------------|
| Mobile | Podium empilé verticalement ; tableau scrollable horizontalement |
| Tablette | Podium compact, graphique pleine largeur |
| Desktop | Layout 3 colonnes pour le podium, graphique large |

- Graphique : hauteur adaptative, légende repliable sur petit écran

---

## 5. États particuliers

| État | Affichage |
|------|-----------|
| Chargement initial | Skeleton / spinner sur podium et tableau |
| Historique insuffisant (< 3 snapshots) | Message « Historique insuffisant — premières alertes bientôt » |
| Erreur de chargement JSON | Message d'erreur avec bouton recharger |
| Participant inactif | Grisé dans le tableau, absent du podium, courbe en pointillés sur le graphique |
