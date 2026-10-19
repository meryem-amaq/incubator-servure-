# 🚀 Guide de Déploiement et de Mise à Jour Continue (Serveur Ubuntu / Debian)

Ce guide détaille la mise en place et l'administration de l'application **IDS Incubateur CGS** dans le répertoire `/var/www/incubateur-cgs`.

Grâce à cette configuration, **vous n'avez jamais besoin de supprimer ni de réinstaller le projet** lors d'une mise à jour : une seule commande suffit pour synchroniser le code sans aucune coupure de service.

---

## 📋 Table des Matières

1. [Prérequis Système](#1-prérequis-système)
2. [Installation Initiale (Une seule fois)](#2-installation-initiale-une-seule-fois)
3. [Mises à Jour Continues (Workflow Quotidien)](#3-mises-à-jour-continues-workflow-quotidien)
4. [Configuration Nginx (Reverse Proxy)](#4-configuration-nginx-reverse-proxy)
5. [Gestion et Maintenance avec PM2](#5-gestion-et-maintenance-avec-pm2)
6. [Sauvegarde et Sécurité](#6-sauvegarde-et-sécurité)
7. [Plan d'Activation de la Synchronisation Cloud (IDS <-> Heroku)](#7-plan-dactivation-de-la-synchronisation-cloud-ids---heroku)

---

## 1. Prérequis Système

Sur le serveur (connecté en `ssh`), assurez-vous d'avoir les outils nécessaires :

```bash
# Mettre à jour la liste des paquets
sudo apt update && sudo apt upgrade -y

# Installer Git, curl et Nginx
sudo apt install -y git curl nginx

# Installer Node.js (v20 LTS recommandé)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installer PM2 globalement (gestionnaire de processus Node.js)
sudo npm install -g pm2
```

---

## 2. Installation Initiale (Une seule fois)

### Étape 2.1 : Cloner le dépôt officiel

```bash
# Se placer dans le répertoire racine des applications web
cd /var/www

# Cloner le dépôt GitHub officiel
sudo git clone https://github.com/meryem-amaq/incubator-servure-.git incubateur-cgs

# Donner la propriété du dossier à votre utilisateur actuel (ex: fablab)
sudo chown -R $USER:$USER /var/www/incubateur-cgs

# Accéder au projet
cd /var/www/incubateur-cgs
```

---

### Étape 2.2 : Rendre le script de mise à jour exécutable

```bash
chmod +x update.sh
```

---

### Étape 2.3 : Configurer l'environnement Backend (.env)

Créez le fichier de configuration locale à partir de l'exemple :

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Renseignez les variables indispensables dans `backend/.env` :
```env
PORT=8080
NODE_ENV=production

# Base de données MySQL locale
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=incubateur_cgs
DB_USER=root
DB_PASSWORD=VotreMotDePasseMySQL

# Clé de sécurité pour les jetons de connexion
JWT_SECRET=cgs_incubateur_secret_key_ids_production_platform

# URL publique de l'application
FRONTEND_URL=http://votre-ip-ou-domaine.com

# Synchronisation Cloud (optionnelle, laisser false si pas encore activée)
ACTIVER_SYNC_CLOUD=false
```

---

### Étape 2.4 : Lancer le premier déploiement automatique

Exécutez simplement :

```bash
./update.sh
```

Le script va :
1. Télécharger les derniers commits.
2. Installer toutes les dépendances `backend` et `frontend`.
3. Compiler le frontend React optimisé pour la production (`frontend/dist`).
4. Démarrer l'application Node.js en tâche de fond avec PM2 sous le nom `ids-app`.

Activez le redémarrage automatique au démarrage du serveur :
```bash
pm2 startup
pm2 save
```

---

## 3. Mises à Jour Continues (Workflow Quotidien)

Dès que vous développez ou corrigez des éléments en local sur votre PC :

### A. Sur votre ordinateur local (VS Code / Terminal) :

Poussez vos modifications sur GitHub :
```bash
git add .
git commit -m "feat: description de vos modifications"
git push origin main
```

### B. Sur le serveur (`/var/www/incubateur-cgs$`) :

Exécutez simplement :
```bash
./update.sh
```

### ⚡ Que fait `./update.sh` en arrière-plan ?

- `git fetch & reset` : Télécharge uniquement les fichiers modifiés (`backend` et `frontend`) sans jamais écraser votre `.env` ni vos images/documents téléversés (`uploads/`).
- `npm run install:all` : Met à jour les modules npm uniquement si de nouveaux paquets ont été ajoutés.
- `npm run build` : Recompile le frontend React instantanément.
- `pm2 reload ids-app` : Recharge le serveur Node.js à chaud **sans déconnecter les utilisateurs**.

---

## 4. Configuration Nginx (Reverse Proxy)

Nginx reçoit les requêtes web sur le port 80 (HTTP) ou 443 (HTTPS) et les transmet au backend Node.js (port 8080), qui distribue automatiquement l'API et le frontend React compilé.

### Étape 4.1 : Créer le fichier de configuration

```bash
sudo nano /etc/nginx/sites-available/incubateur-cgs
```

Collez le contenu suivant (remplacez `votre-domaine-ou-ip` par votre IP ou nom de domaine réel) :

```nginx
server {
    listen 80;
    server_name votre-domaine-ou-ip;

    # Taille max des uploads (fichiers, CV, pièces jointes)
    client_max_body_size 50M;

    # Compression Gzip pour des temps de chargement ultra-rapides
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Étape 4.2 : Activer le site

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/incubateur-cgs /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

---

## 5. Gestion et Maintenance avec PM2

| Action | Commande |
| :--- | :--- |
| **Voir l'état de l'application** | `pm2 status` |
| **Consulter les logs en direct** | `pm2 logs ids-app` |
| **Consulter les 100 dernières lignes de logs** | `pm2 logs ids-app --lines 100` |
| **Redémarrer manuellement l'application** | `pm2 restart ids-app` |
| **Arrêter l'application** | `pm2 stop ids-app` |
| **Suivre la consommation RAM / CPU** | `pm2 monit` |

---

## 6. Sauvegarde et Sécurité

1. **Fichiers protégés contre `git` :**
   - `backend/.env` : Ne sera jamais effacé ni modifié par un `git pull` ou `update.sh`.
   - `backend/uploads/` : Contient les photos de profil, fiches projets et signatures. Ce dossier est préservé.
2. **Sauvegarde MySQL :**
   Pour créer une sauvegarde de la base de données :
   ```bash
   mysqldump -u root -p incubateur_cgs > backup_$(date +%F).sql
   ```

---

## 7. Plan d'Activation de la Synchronisation Cloud (IDS <-> Heroku)

Ce plan vous explique exactement comment activer la passerelle entre votre serveur officiel et la plateforme Cloud Heroku une fois l'installation sur le serveur terminée.

> **Note importante :** Tant que cette étape n'est pas activée, les deux serveurs (votre serveur officiel et Heroku) fonctionnent de manière totalement indépendante sans jamais se bloquer !

### Étape 7.1 : Configurer le fichier .env sur le serveur officiel

Dans le terminal de votre serveur officiel, éditez `backend/.env` :

```bash
nano /var/www/incubateur-cgs/backend/.env
```

Ajoutez ou mettez à jour ces deux lignes :

```env
# Active l'envoi de la liste blanche des porteurs de projet vers Heroku
ACTIVER_SYNC_CLOUD=true

# L'adresse de votre interface Cloud publique (qui sert de relais)
CLOUD_URL=https://ids-production-app-6aba82b6af10.herokuapp.com
```

### Étape 7.2 : Recharger l'application

Rechargez l'application Node.js pour prendre en compte les nouvelles variables :

```bash
pm2 reload ids-app --update-env
```

### Étape 7.3 : Vérification automatique du fonctionnement

Dès le redémarrage :

1. **Dans le sens (Cloud Heroku ➔ Serveur Officiel) :**
   - Le service `SyncService` s'active automatiquement.
   - Toutes les **10 minutes**, il interroge Heroku pour récupérer les nouvelles réservations d'espaces (Fablab/Studio) et les émargements aux formations effectués par QR Code.
   - Vous pouvez observer la synchronisation dans les logs :
     ```bash
     pm2 logs ids-app
     ```
2. **Dans le sens (Serveur Officiel ➔ Cloud Heroku) :**
   - À chaque fois que vous ajoutez, modifiez ou supprimez un incubé dans l'interface admin, la nouvelle **liste blanche** (emails et numéros de projet) est envoyée silencieusement vers Heroku pour autoriser immédiatement les porteurs de projet à réserver et émarger par QR Code.
3. **Déclenchement manuel instantané :**
   - Vous pouvez forcer une synchronisation immédiate à tout moment depuis le serveur officiel via :
     ```bash
     npm run sync:cloud --prefix /var/www/incubateur-cgs/backend
     ```

