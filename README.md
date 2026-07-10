# Addon IPTV Xtream pour Nuvio / Stremio

Addon qui permet de connecter un abonnement IPTV **Xtream Codes** (host + user + pass) à Nuvio, avec Live TV, Films et Séries, catalogues avec genres/recherche/pagination.

---

## 0. Ce dont tu as besoin

- Un compte IPTV **Xtream Codes** valide (host, username, password) — c'est le protocole utilisé par TiviMate, IPTV Smarters, etc.
- Un ordinateur avec **Node.js** installé (version 18 ou plus).
- Pour que Nuvio (sur ton téléphone/TV) puisse accéder à l'addon, il faut que le serveur soit **accessible sur internet** — donc à un moment donné, il faudra le déployer en ligne (étape 4). En local, ça ne marchera que si Nuvio tourne sur le même réseau ou via un tunnel (ngrok).

---

## 1. Installer Node.js

Si tu ne l'as pas déjà :
- Va sur https://nodejs.org
- Télécharge la version **LTS** et installe-la (Suivant, Suivant, Terminer)
- Vérifie que ça fonctionne en ouvrant un terminal (PowerShell sur Windows, Terminal sur Mac/Linux) et tape :
  ```
  node -v
  npm -v
  ```
  Tu dois voir des numéros de version s'afficher.

---

## 2. Installer le projet

1. Récupère le dossier `nuvio-xtream-addon` (celui que je t'ai généré).
2. Ouvre un terminal **dans ce dossier**. Par exemple :
   ```
   cd chemin/vers/nuvio-xtream-addon
   ```
3. Installe les dépendances :
   ```
   npm install
   ```
4. Lance le serveur :
   ```
   npm start
   ```
5. Tu dois voir dans le terminal :
   ```
   Addon Xtream lancé sur http://localhost:7000
   Page de config : http://localhost:7000/configure.html
   ```

À ce stade, l'addon tourne **en local sur ton ordinateur**. Ça permet de tester, mais Nuvio sur ton téléphone ne pourra pas encore s'y connecter (sauf test sur le même PC).

---

## 3. Tester en local

1. Ouvre ton navigateur sur `http://localhost:7000/configure.html`
2. Remplis host / username / password de ton abonnement Xtream
3. Clique sur "Générer le lien" → tu obtiens une URL du type :
   ```
   http://localhost:7000/eyJob3N0IjoiLi4uIn0/manifest.json
   ```
4. Ouvre cette URL dans le navigateur : tu dois voir le JSON du manifest s'afficher (avec `catalogs`, `types`, etc.) — si tu vois ça, l'addon fonctionne côté serveur.

---

## 4. Mettre l'addon en ligne (obligatoire pour Nuvio mobile)

Le plus simple et gratuit pour démarrer : **Render.com**.

### Option A — Render (recommandé, gratuit pour commencer)

1. Crée un compte sur https://render.com
2. Mets ton code sur GitHub :
   - Crée un repo GitHub (ex: `nuvio-xtream-addon`)
   - Depuis le dossier du projet :
     ```
     git init
     git add .
     git commit -m "premier commit"
     git branch -M main
     git remote add origin https://github.com/TON_USER/nuvio-xtream-addon.git
     git push -u origin main
     ```
3. Sur Render : **New +** → **Web Service** → connecte ton repo GitHub
4. Configure :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : Free
5. Déploie. Render te donne une URL du type `https://nuvio-xtream-addon.onrender.com`

⚠️ Sur le plan gratuit, Render met le service en veille après inactivité (le premier chargement peut prendre 30-50s). Si ça te gêne, passe sur un plan payant (~7$/mois) ou utilise Railway/Fly.io.

### Option B — Railway

Même principe : compte sur https://railway.app, "New Project" → "Deploy from GitHub repo", il détecte automatiquement Node.js et lance `npm start`.

### Option C — Ton propre VPS (si tu en as déjà un, type OVH/Scaleway)

```
git clone ton-repo
cd nuvio-xtream-addon
npm install
npm install -g pm2
pm2 start server.js --name xtream-addon
pm2 save
```
Puis mets un reverse proxy Nginx + certificat SSL (Let's Encrypt / Certbot) devant, pour avoir une URL en `https://`.

---

## 5. Générer ton lien d'installation en ligne

Une fois déployé, va sur :
```
https://TON-URL-RENDER.onrender.com/configure.html
```
Remplis tes identifiants Xtream, génère le lien, copie-le. Il ressemble à :
```
https://TON-URL-RENDER.onrender.com/eyJob3N0IjoiLi4uIn0/manifest.json
```

---

## 6. Installer l'addon dans Nuvio

Dans Nuvio, il doit y avoir une section type "Addons" ou "Ajouter un addon via URL" (le fonctionnement est identique aux addons Stremio classiques puisque Nuvio se base sur le même protocole) :
1. Ouvre Nuvio
2. Va dans les paramètres/addons
3. Colle l'URL du manifest générée à l'étape 5
4. Valide → les catalogues "IPTV - Live TV", "IPTV - Films", "IPTV - Séries" doivent apparaître

---

## 7. Ce que fait l'addon concrètement

- **Live TV** : liste tes chaînes, avec filtre par genre, recherche, pagination (100 chaînes par page pour éviter les timeouts)
- **Films** : catalogue VOD avec poster, genre, année
- **Séries** : catalogue avec, pour chaque série, la liste des saisons/épisodes générée depuis l'API Xtream
- Les identifiants ne sont **jamais stockés côté serveur** : ils sont encodés dans l'URL du manifest (base64), donc chaque utilisateur a sa propre URL et ses propres identifiants. Le serveur ne garde qu'un cache temporaire des catalogues (1h) pour ne pas surcharger ton serveur Xtream à chaque requête.

---

## 8. Limites connues / pistes d'amélioration

- Pas encore d'EPG (programme TV en cours) affiché sur les chaînes live — l'API `get_short_epg` est déjà branchée côté client (`lib/xtreamClient.js`), il reste à l'exploiter dans le mapper si tu veux l'ajouter.
- Pas de gestion multi-comptes dans une seule URL (un lien = un compte Xtream).
- Le cache est en mémoire : si tu redéploies ou redémarres le serveur, il se reconstruit tout seul (pas grave, juste un peu plus lent au premier chargement).

---

## 9. Si quelque chose ne marche pas

- **Le manifest renvoie une erreur 500** → vérifie host/user/pass, teste-les d'abord dans une appli comme IPTV Smarters pour confirmer que le compte fonctionne.
- **Nuvio n'arrive pas à charger l'addon** → vérifie que l'URL est bien en `https://` et accessible publiquement (ouvre-la dans un navigateur externe, pas juste en local).
- **Les flux ne se lancent pas** → certains serveurs Xtream bloquent les connexions simultanées ou changent l'extension des fichiers ; regarde les logs du serveur (`console.log` dans le terminal ou logs Render) pour voir l'URL de stream générée et teste-la directement dans VLC.

---

Dis-moi une fois que tu as testé en local (étape 3) — on debug ensemble si besoin avant de passer au déploiement.
