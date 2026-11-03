# Plan d'implémentation : Optimisation de l'interface mobile pour NumsGames

Amélioration ergonomique complète de NumsGames pour smartphones (écrans 375px à 430px) tout en préservant l'expérience complète sur ordinateur.

---

## 1. Contexte & Choix de l'utilisateur

- **Besoin :** Rendre la navigation et la prise de commande parfaitement fluides sur smartphone pour les élèves du lycée.
- **Choix validé :** Tunnel de commande mobile en **deux étapes distinctes** :
  - **Étape 1 :** Découverte et sélection tactile des jeux / packs avec filtres rapides et barre d'action sticky en bas d'écran.
  - **Étape 2 :** Récapitulatif clair de la sélection + saisie des coordonnées de l'élève (Prénom, Nom, précisions) + validation et envoi de la commande.
- **Simulateur d'écran LCD NumWorks :** Adapté en version compacte et dépliable sur mobile pour ne pas encombrer l'écran tactile, tout en conservant le grand rendu LCD sur ordinateur.

---

## 2. Modifications proposées

### A. Navigation de commande en 2 étapes sur mobile (`mobileStep: 'select' | 'details'`)
- **Étape 1 (Sélection des jeux)** :
  - Liste défilable des jeux optimisée pour le pouce (`min-h-[48px]`, zones de frappe élargies, badges de prix voyants).
  - Filtres par catégorie horizontaux avec défilement fluide sans barre gênante (`overflow-x-auto no-scrollbar`).
  - Écran LCD NumWorks compact sous forme de bandeau synthétique ou accordéon repliable (`Afficher l'écran NumWorks ▾`).
  - **Barre d'action sticky en bas d'écran (Bottom CTA Bar)** :
    - Hauteur limitée (strictement inférieure à 15% du viewport).
    - Affiche en direct le nombre d'articles cochés et le montant (ex: `3 scripts · 2 €` ou `Pokémon Cristal · 4 €`).
    - Bouton tactile large `Continuer vers mes coordonnées →` qui bascule sur l'Étape 2.
- **Étape 2 (Formulaire & Validation)** :
  - Bouton retour évident `← Revenir au choix des jeux` sans perdre la sélection.
  - Carte récapitulative de la commande avec le prix calculé.
  - Champs `input` à taille `text-base` (16px) pour désactiver le zoom forcé automatique d'iOS Safari lors du focus.
  - Bouton final d'envoi bien visible `Générer mon ticket de commande` avec déclenchement direct de l'e-mail automatique et enregistrement Firebase.

### B. Maintien de l'expérience sur Desktop
- Sur grand écran (`md:` et plus), l'affichage reste en **2 colonnes simultanées** (Sélection à gauche avec grand écran LCD + Formulaire permanent à droite), garantissant une efficacité maximale sans étape intermédiaire.

### C. Polissage tactile des autres écrans
1. **Écran d'Accueil :**
   - Réduction des marges excessives sur mobile pour afficher les 3 cartes d'offres sans défilement interminable.
   - Boutons de cartes adaptés au toucher avec retour visuel immédiat (`active:scale-[0.98]`).
2. **Écran Ticket de Commande :**
   - Cibles tactiles $\ge 44\text{px}$ pour "Copier le texte" et "Nouvelle commande".
   - Rappel de consigne bien encadré et centré pour lecture rapide sur téléphone.
3. **Espace Administrateur (Secret 1324) :**
   - Pavé numérique adapté au pouce sur mobile (`w-14 h-14` par touche).
   - Fiches de commandes empilées avec badges de statut et boutons d'action (Gmail direct, statut, suppression) facilement actionnables au doigt.

---

## 3. Plan de vérification
- **Vérification compilation :** `compile_applet` et `tsc --noEmit` pour valider l'absence totale d'erreurs TypeScript.
- **Tests ergonomiques responsives :**
  - Vérifier le fonctionnement de l'étape 1 (sélection) vers l'étape 2 (formulaire) sur écran mobile.
  - Vérifier que la sélection reste intacte en cas de retour à l'étape 1.
  - Vérifier que la vue desktop 2 colonnes reste intacte.
  - Vérifier la soumission de commande, l'enregistrement Firestore et l'envoi de l'e-mail automatique.
