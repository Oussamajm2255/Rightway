# PROMPT — Page Produits & Bénéfices (20 000 €)

## Contexte

L'application **Right Way** gère un dépôt, des livraisons terrain, et suit les ventes. Chaque produit a un **prix d'achat** (`purchase_price`) et un **prix de vente** (`selling_price_ttc`). À la clôture des livraisons (`CLOTURE`), les quantités vendues (`qte_vendue`) sont enregistrées par article. On peut donc calculer **le bénéfice global** de l'entreprise et **le bénéfice par produit**.

Cette page est exclusivement accessible au **SUPER_ADMIN**. Elle doit servir de tableau de bord stratégique pour piloter la rentabilité.

---

## 1. Données disponibles (schéma réel)

### Table `products`
| Colonne | Type | Description |
|---|---|---|
| `id` | VARCHAR(20) | Identifiant PROD-XXX |
| `barcode` | VARCHAR(20) UNIQUE | Code-barres |
| `name` | VARCHAR(100) | Nom du produit |
| `category` | VARCHAR(50) | Catégorie (optionnelle) |
| `purchase_price` | NUMERIC(10,3) | **Prix d'achat unitaire** |
| `selling_price_ttc` | NUMERIC(10,3) | Prix de vente TTC catalogue |
| `is_active` | BOOLEAN | Archivé ou non |
| `created_at` | TIMESTAMPTZ | Date de création |

### Table `depot_stock`
| Colonne | Type | Description |
|---|---|---|
| `product_id` | VARCHAR(20) FK | Lien vers products |
| `quantity` | INTEGER | Stock actuel en dépôt |

### Table `livraison_items`
| Colonne | Type | Description |
|---|---|---|
| `livraison_id` | UUID FK | Lien vers livraisons |
| `product_id` | VARCHAR(20) FK | Lien vers products |
| `qte_chargee` | INTEGER | Quantité chargée au départ |
| `qte_vendue` | INTEGER | Quantité effectivement vendue |
| `prix_ttc` | NUMERIC(10,3) | Prix TTC appliqué sur cette ligne |

### Table `livraisons`
- `status = 'CLOTURE'` → livraison terminée, ventes définitives
- `is_archived = false` → exclure les archivées
- `closed_at` → date de clôture (pour filtrage par période)

---

## 2. Formules de calcul

### Bénéfice unitaire par ligne vendue
```
benefit_per_unit = li.prix_ttc - p.purchase_price
```

### CA par produit
```
ca_product = SUM(li.qte_vendue * li.prix_ttc)
  FROM livraison_items li
  JOIN livraisons l ON li.livraison_id = l.id
  WHERE l.status = 'CLOTURE' AND l.is_archived = false
  GROUP BY li.product_id
```

### Coût des ventes par produit
```
cost_product = SUM(li.qte_vendue * p.purchase_price)
  (mêmes jointures + JOIN products p ON li.product_id = p.id)
```

### Bénéfice net par produit
```
benefit_product = SUM(li.qte_vendue * (li.prix_ttc - p.purchase_price))
```

### Marge (%) par produit
```
margin_pct = (benefit_product / ca_product) * 100   (si ca_product > 0)
```

### Bénéfice global
```
global_benefit = SUM(li.qte_vendue * (li.prix_ttc - p.purchase_price))
  sur TOUS les produits, toutes livraisons CLOTURE non archivées
```

### Quantité totale vendue par produit
```
total_sold = SUM(li.qte_vendue)
```

### Stock restant par produit
```
stock_restant = COALESCE(ds.quantity, 0)
```

---

## 3. Structure de la page

La page doit être divisée en **deux sections verticales** :

### SECTION A — Bénéfice Global (KPI Cards)
Une rangée de **4 cartes KPI** en haut de page, affichant les agrégats globaux :

| Carte | Label | Valeur | Icône |
|---|---|---|---|
| CA Global | "Chiffre d'Affaires Total" | Somme de tous les CA CLOTURE non archivés, format `X.XXX DT` | 💰 |
| Bénéfice Net Global | "Bénéfice Net Total" | `global_benefit` en DT, couleur verte si positif, rouge si négatif | 📈 |
| Marge Moyenne | "Marge Bénéficiaire Moyenne" | `(global_benefit / global_ca) * 100`, affiché en % avec 1 décimale | 📊 |
| Produits Rentables | "Produits Rentables" | Nombre de produits ayant `benefit_product > 0`, style compteur | ✅ |

Les cartes doivent reprendre le style des KPI cards existantes du dashboard (accent coloré à gauche, icône, label, valeur, sous-texte).

---

### SECTION B — Tableau Détaillé par Produit

Un **tableau classable et filtrable** listant tous les produits actifs avec leurs métriques de bénéfice.

#### Colonnes du tableau

| # | Colonne | Description | Triable |
|---|---|---|---|
| 1 | Code | `product.id` (ex: PROD-001) | ✅ |
| 2 | Produit | `product.name` | ✅ |
| 3 | Catégorie | `product.category` (badge pastel) | ✅ |
| 4 | Prix Achat | `purchase_price` format `X.XXX DT` | ✅ |
| 5 | Prix Vente | `selling_price_ttc` format `X.XXX DT` | ✅ |
| 6 | Qté Vendue | `total_sold` (entier) | ✅ |
| 7 | CA | `ca_product` format `X.XXX DT` | ✅ |
| 8 | Coût | `cost_product` format `X.XXX DT` | ✅ |
| 9 | Bénéfice | `benefit_product` format `X.XXX DT` — **vert si > 0, rouge si < 0** | ✅ |
| 10 | Marge % | `margin_pct` avec 1 décimale + symbole `%` — **barre de progression colorée** (verte = élevée, jaune = moyenne, rouge = basse/négative) | ✅ |

#### Fonctionnalités du tableau

- **Tri par colonne** : clic sur l'en-tête pour trier ascendant/descendant
- **Recherche textuelle** : barre de recherche filtrant par nom ou code
- **Filtre par catégorie** : dropdown avec toutes les catégories + option "Toutes"
- **Filtre par période** : deux date pickers (date début / date fin) pour restreindre aux livraisons clôturées dans une période — par défaut "toute période"
- **Tri par défaut** : Bénéfice décroissant (les plus rentables en premier)
- **Row coloring par catégorie** : comme dans les autres tableaux du projet, appliquer des couleurs de fond pastel distinctes par catégorie pour la scannabilité
- **Ligne de total** en pied de tableau (sticky) : somme de CA, Coût, Bénéfice
- **Export CSV** : bouton pour télécharger les données du tableau en CSV
- **Pagination** : si plus de 50 produits, paginer par pages de 50

---

## 4. Graphique (Chart.js)

Sous le tableau, un **graphique en barres horizontales** (Chart.js) montrant le **Top 15 des produits par bénéfice** :

- Axe Y → nom du produit (tronqué à 25 caractères)
- Axe X → bénéfice en DT
- Barres colorées en vert (`#0f9e6a`) pour bénéfice positif, rouge (`#dc2626`) pour négatif
- Tooltip au survol : "Produit X : Y.YYY DT (Z.Z% marge)"
- Responsive : la hauteur s'adapte au nombre de barres (min 400px)

---

## 5. Contraintes techniques

### Backend (Node.js / Express / PostgreSQL)

Créer un **nouveau endpoint** :

```
GET /api/benefits
```

**Query params acceptés :**
- `category` (optionnel) — filtre par catégorie
- `search` (optionnel) — recherche par nom ou code
- `date_from` (optionnel) — ISO date, filtre `l.closed_at >=`
- `date_to` (optionnel) — ISO date, filtre `l.closed_at <=`
- `sort_by` (optionnel, défaut: `benefit`) — colonne de tri
- `sort_dir` (optionnel, défaut: `desc`) — `asc` ou `desc`
- `page` (optionnel, défaut: `1`) — numéro de page
- `limit` (optionnel, défaut: `50`) — éléments par page

**Middleware :**
```js
router.get('/benefits', authenticate, authorize('SUPER_ADMIN'), getBenefits);
```

**Réponse JSON attendue :**
```json
{
  "global": {
    "ca_total": 12345.678,
    "benefit_total": 3456.789,
    "margin_avg": 28.0,
    "profitable_count": 42
  },
  "products": [
    {
      "id": "PROD-001",
      "name": "...",
      "category": "...",
      "barcode": "...",
      "purchase_price": 1.200,
      "selling_price_ttc": 2.500,
      "total_sold": 150,
      "ca": 375.000,
      "cost": 180.000,
      "benefit": 195.000,
      "margin_pct": 52.0
    }
  ],
  "total": 85,
  "page": 1,
  "limit": 50
}
```

**Structure des fichiers à créer :**
- `server/src/models/benefit.js` — requêtes SQL (fonctions `getGlobalBenefits`, `getProductBenefits`)
- `server/src/controllers/benefits.js` — logique métier, agrégation, formatage
- `server/src/routes/benefits.js` — route SUPER_ADMIN uniquement
- Dans `server/src/index.js` : monter la route → `app.use('/api', benefitsRouter)`

**La requête SQL principale doit :**
1. Joindre `livraison_items` → `livraisons` → `products`
2. Filtrer `l.status = 'CLOTURE' AND l.is_archived = false`
3. Grouper par `product_id`
4. Calculer SUM(qte_vendue * prix_ttc) comme CA
5. Calculer SUM(qte_vendue * (prix_ttc - purchase_price)) comme BÉNÉFICE
6. Inclure les produits qui n'ont **jamais été vendus** (LEFT JOIN → benefit = 0, ca = 0) pour avoir la liste complète du catalogue
7. Appliquer les filtres category/search/période dynamiquement
8. Trier et paginer

### Frontend (React / Vite)

**Nouveau fichier à créer :**
- `client/src/pages/BenefitsPage.jsx`
- `client/src/pages/BenefitsPage.css`

**Intégration :**
- Dans `App.jsx` : ajouter la route `/benefits` protégée avec `<RoleGuard role="SUPER_ADMIN">`
- Dans `AppLayout.jsx` : ajouter l'entrée de navigation "Bénéfices" dans `NAV_ITEMS` pour SUPER_ADMIN uniquement (visible seulement si `user.role === 'SUPER_ADMIN'`), avec une icône `IconBenefits` (svg style graph/finance)
- La sidebar doit afficher "Bénéfices" dans la section SUPER_ADMIN

**Design à respecter :**
- Même charte graphique que le reste de l'application :
  - Couleurs : palette définie dans `index.css` (variables CSS `--color-*`)
  - Polices : Inter (corps), JetBrains Mono (données monospace/chiffres)
  - Cartes KPI : identiques au style `.kpi-card` du dashboard
  - Tableau : identique au style `.data-table-db` du dashboard
  - Bordures : `var(--color-border)`, radius `var(--radius-lg)`
  - Responsive : les KPI cards passent de 4 → 2 → 1 colonnes, le tableau est scrollable horizontalement sur mobile

---

## 6. Restrictions d'accès

- **Route API** : protégée par `authenticate` + `authorize('SUPER_ADMIN')`
- **Route Frontend** : wrappée dans `<RoleGuard role="SUPER_ADMIN">`
- **Navigation** : l'item "Bénéfices" dans la sidebar NE doit PAS apparaître pour ADMIN ni COMMERCIAL
- Si un utilisateur non SUPER_ADMIN tente d'accéder à `/benefits`, il est redirigé vers `/dashboard`

---

## 7. Livrables attendus

1. **Backend complet** :
   - `server/src/models/benefit.js` — fonctions SQL
   - `server/src/controllers/benefits.js` — contrôleur avec gestion des query params
   - `server/src/routes/benefits.js` — route protégée
   - Intégration dans `server/src/index.js`

2. **Frontend complet** :
   - `client/src/pages/BenefitsPage.jsx` — page React complète
   - `client/src/pages/BenefitsPage.css` — styles responsives
   - Modification de `client/src/App.jsx` — ajout route + RoleGuard
   - Modification de `client/src/components/AppLayout.jsx` — ajout nav item + icône SVG

3. **Aucune modification de la base de données** — les tables existantes suffisent

---

## 8. Critères de qualité

- Tous les montants en DT avec **3 décimales** (format `X.XXX DT`)
- Pourcentages avec **1 décimale** (format `XX.X%`)
- Bénéfices **positifs en vert** (`#0f9e6a`), **négatifs en rouge** (`#dc2626`)
- Les produits sans aucune vente doivent apparaître avec `ca: 0`, `benefit: 0`, `margin_pct: 0`, `total_sold: 0` (pas de ligne vide ou absente)
- Le tableau doit supporter le **tri client-side** une fois les données chargées (pas de re-fetch au changement de tri)
- La recherche, le filtre catégorie, et le filtre période doivent déclencher un **re-fetch API**
- L'état de chargement affiche un **squelette** (placeholder cards) comme le dashboard
- Les erreurs API sont affichées dans un bandeau d'erreur avec possibilité de réessayer
- Responsive : testé et fonctionnel sur desktop, tablette, et mobile
