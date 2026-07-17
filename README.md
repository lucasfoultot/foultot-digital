# Foultot Digital → PWA + Firebase

Ce que t'as maintenant : la même appli (dossiers par fournisseur), mais qui tourne
en vrai appli installable, avec synchro auto entre ton PC et les tablettes de
l'équipe, et consultation hors-ligne des fichiers déjà vus.

Comment ça marche concrètement :
- Tu ajoutes une photo sur ton PC → elle part sur Firebase (le cloud).
- Chaque tablette connectée en wifi la récupère toute seule et la garde en
  mémoire (IndexedDB) → donc dispo même sans wifi ensuite, sur un chantier.
- Zéro appli à publier sur un store : c'est un lien, on "l'installe" en 2 clics.

Il te reste 3 trucs à faire, tous dans le navigateur, pas besoin d'installer
quoi que ce soit sur ton PC.

---

## Étape 1 — Créer le projet Firebase (10 min, gratuit)

1. Va sur **https://console.firebase.google.com** et connecte-toi avec un
   compte Google (idéalement un compte pro Menuiserie Foultot si vous en avez
   un, sinon le tien).
2. **Ajouter un projet** → nom au choix, ex. `foultot-digital`. Tu peux
   désactiver Google Analytics (pas utile ici).
3. Une fois le projet créé, dans le menu de gauche :
   - **Build → Firestore Database** → *Créer une base de données* → choisis
     une région proche (ex. `eur3 (europe-west)`) → démarre en **mode
     production**.
   - **Build → Storage** → *Commencer* → même région → mode production.
4. **Règles de sécurité** (important, sinon rien ne marche) :
   - Dans Firestore → onglet **Règles**, remplace tout par :
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /files/{fileId} {
           allow read, write: if true;
         }
       }
     }
     ```
   - Dans Storage → onglet **Règles**, remplace tout par :
     ```
     rules_version = '2';
     service firebase.storage {
       match /b/{bucket}/o {
         match /files/{allPaths=**} {
           allow read, write: if true;
         }
       }
     }
     ```
   - **⚠️ Ces règles sont ouvertes** : n'importe qui avec le lien de l'appli
     peut lire/écrire. C'est comme JSONBin avant : ok pour un outil interne
     dont le lien n'est pas public, mais pas blindé. Si un jour tu veux
     verrouiller (mot de passe équipe, comptes Google...), dis-le-moi, on
     ajoute une couche d'auth simple.
5. Récupère la config : icône ⚙️ (Paramètres du projet) → en bas, section
   *Vos applications* → **</> (Web)** → donne-lui un nom (ex. `web`) → **PAS**
   besoin de cocher Firebase Hosting → *Enregistrer l'application*. Firebase
   t'affiche un bloc `firebaseConfig = {...}` : **copie-le**, tu en as besoin
   à l'étape 2.

---

## Étape 2 — Coller ta config dans le fichier

Ouvre `index.html`, tout en bas dans la balise `<script type="module">`, tu
verras ça en premier :

```js
const firebaseConfig = {
  apiKey: "COLLER_ICI",
  authDomain: "COLLER_ICI",
  projectId: "COLLER_ICI",
  storageBucket: "COLLER_ICI",
  messagingSenderId: "COLLER_ICI",
  appId: "COLLER_ICI"
};
```

Remplace ces 6 valeurs par celles que Firebase t'a données à l'étape 1.5.
Sauvegarde. C'est tout pour le code.

---

## Étape 3 — Héberger gratuitement

Le plus simple pour toi : mettre les fichiers dans un sous-dossier de votre
site existant (menuiserie-foultot.com), vu que t'as déjà l'accès WordPress/FTP.

1. Crée un dossier `digital/` à la racine du site (via le gestionnaire de
   fichiers de ton hébergeur, ou FTP/FileZilla).
2. Envoie dedans ces 6 fichiers : `index.html`, `manifest.json`, `sw.js`,
   `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`.
3. L'appli sera accessible sur `https://menuiserie-foultot.com/digital/` —
   c'est ce lien que tu partages à l'équipe (Jérémy, Alexis...).

**Alternative sans toucher au site** si tu préfères séparer : GitHub Pages
(gratuit aussi). Crée un compte GitHub, un nouveau repo public, glisse les 6
fichiers dedans par glisser-déposer dans le navigateur, puis Settings →
Pages → active sur la branche `main`. Tu obtiens un lien du style
`https://tonpseudo.github.io/foultot-digital/`.

Les deux marchent pareil pour la partie Firebase — choisis celle qui t'arrange.

---

## Étape 4 — Installer sur les tablettes / PC de l'équipe

1. Ouvre le lien sur la tablette (Chrome/Safari), en wifi.
2. Chrome Android : menu ⋮ → **Installer l'application** (ou un bandeau
   apparaît tout seul). Safari iPad : bouton Partager → **Sur l'écran
   d'accueil**.
3. Une icône "Foultot Digital" apparaît, comme une vraie appli. Ouvre-la une
   fois en wifi pour qu'elle récupère les fichiers déjà présents — après ça,
   ils restent dispo hors-ligne sur cette tablette.

---

## Au quotidien

- Tu importes une photo/PDF depuis ton PC (bouton "Importer des fichiers"
  dans un dossier) → elle part sur Firebase direct.
- Un petit badge en haut à droite indique l'état : *En ligne / Hors-ligne
  (cache local) / Synchronisation…*
- Sur une tablette hors wifi, tout ce qui a déjà été vu une fois reste
  consultable. Les nouveaux ajouts arrivent dès que le wifi revient.
- Suppression : elle se propage aussi à tout le monde (Firestore + Storage).

## Limites à connaître

- Plan gratuit Firebase (Spark) : 1 Go de stockage Storage, 10 Go de
  téléchargement/mois, 50k lectures Firestore/jour. Largement suffisant pour
  des photos de chantier en usage interne équipe ; on avisera si jamais ça
  approche la limite (upgrade Blaze = pay-as-you-go, toujours quasi gratuit à
  ce volume).
- Pas d'upload possible si le PC lui-même est hors-ligne au moment de
  l'ajout (contrairement à la lecture, l'envoi a besoin du wifi).
