# Plan d'implémentation : Résolution de l'alerte de sécurité GitHub (Secret Telegram)

## 1. Contexte du problème
GitHub dispose d'un analyseur de sécurité automatique (« Secret Scanning ») qui inspecte chaque commit. Il a détecté la présence d'un jeton d'accès Telegram Bot Token directement dans le code source de `src/App.tsx`.

Pour clore cette alerte de sécurité et protéger votre bot, le jeton ne doit plus jamais figurer en texte brut dans le dépôt GitHub.

---

## 2. Solution choisie
**Configurer le token dans l'Espace Administrateur privé :**
Le token et votre identifiant Telegram seront stockés de manière sécurisée dans votre espace d'administration privé (protégé par le code PIN 1324) et enregistrés localement dans votre navigateur, sans jamais être commités sur GitHub.

---

## 3. Détail des modifications

### A. Nettoyage du code source (`src/App.tsx`)
- Suppression de la constante codée en dur `TELEGRAM_BOT_TOKEN = '9103740677...'`.
- Remplacement par une fonction dynamique `getSavedTelegramToken()` qui récupère le token soit :
  1. Depuis le stockage local de votre Espace Admin (`localStorage`).
  2. Depuis une variable d'environnement `import.meta.env.VITE_TELEGRAM_BOT_TOKEN` (si vous décidez plus tard d'utiliser un secret GitHub).
  3. Retourne une chaîne vide si non configuré, évitant tout blocage ou plantage du site.

### B. Enrichissement de l'interface Administrateur privé (code 1324)
- Dans la section **Alerte Telegram**, ajout d'un champ sécurisé pour saisir ou modifier le **Token du Bot** (avec masque de type mot de passe `●●●●●` et bouton pour afficher/masquer).
- Sauvegarde locale sécurisée du token et du Chat ID.
- Bouton de test direct pour vérifier que le bot communique bien avec votre smartphone.

### C. Recommandation de sécurité pour Telegram
- Une fois le code nettoyé, nous vous expliquerons comment révoquer l'ancien token auprès de `@BotFather` (commande `/revoke`) pour en générer un nouveau et le coller directement dans votre espace Admin. Ainsi, personne ne pourra utiliser l'ancien jeton qui avait été vu par GitHub.

---

## 4. Plan de vérification
- **Compilation :** Exécution de `compile_applet` pour garantir l'absence totale d'erreurs TypeScript.
- **Linting :** Exécution de `lint_applet` (`tsc --noEmit`).
- **Contrôle d'exposition :** Vérification qu'aucun token Telegram en clair ne subsiste dans les fichiers sources du projet.
