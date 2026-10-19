# 🚀 Guide de Déploiement — Serveur HPE ProLiant G10 (Ubuntu)

## Prérequis
- Serveur HPE ProLiant G10 avec Ubuntu 20.04 / 22.04
- Accès SSH root ou sudo
- IP fixe ou nom de domaine (optionnel pour SSL)

---

## Étape 1 — Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

---

## Étape 2 — Installer Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # doit afficher v20.x.x
```

---

## Étape 3 — Installer MariaDB

```bash
sudo apt install -y mariadb-server
sudo systemctl start mariadb
sudo systemctl enable mariadb
sudo mysql_secure_installation
```

### Créer la base de données :
```sql
CREATE DATABASE incubateur_cgs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cgs_user'@'localhost' IDENTIFIED BY 'VotreMotDePasseSecurise!2024';
GRANT ALL PRIVILEGES ON incubateur_cgs.* TO 'cgs_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## Étape 4 — Installer Nginx + PM2

```bash
sudo apt install -y nginx
sudo npm install -g pm2
```

---

## Étape 5 — Copier les fichiers sur le serveur

```bash
sudo mkdir -p /var/www/incubateur-cgs
# Depuis votre PC Windows (PowerShell) :
scp -r "C:\Users\Mery\.gemini\antigravity-ide\scratch\incubateur-cgs\*" user@IP_SERVEUR:/var/www/incubateur-cgs/
```

---

## Étape 6 — Configurer le Backend

```bash
cd /var/www/incubateur-cgs/backend
npm install
cp .env.example .env
nano .env  # Remplir les valeurs MariaDB + JWT_SECRET

mkdir -p /var/www/incubateur-cgs/uploads
node database/create-admin.js  # Crée les tables + admin
```

---

## Étape 7 — Builder le Frontend

```bash
cd /var/www/incubateur-cgs/frontend
npm install
npm run build
```

---

## Étape 8 — Démarrer avec PM2

```bash
cd /var/www/incubateur-cgs/backend
pm2 start src/app.js --name "cgs-backend"
pm2 save && pm2 startup
```

---

## Étape 9 — Configurer Nginx

```nginx
# /etc/nginx/sites-available/incubateur-cgs
server {
    listen 80;
    server_name VOTRE_IP_OU_DOMAINE;

    root /var/www/incubateur-cgs/frontend/dist;
    index index.html;

    location / { try_files $uri $uri/ /index.html; }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads {
        alias /var/www/incubateur-cgs/uploads;
    }

    client_max_body_size 15M;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/incubateur-cgs /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Étape 10 — Pare-feu + SSL

```bash
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# SSL (si vous avez un domaine) :
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

---

## ✅ Accès à l'application

Ouvrez : **`http://VOTRE_IP`**

Connexion initiale :
- Email : `admin@cgs-incubateur.ma`
- Mot de passe : `Admin@2024`
- ⚠️ Changez le mot de passe après la première connexion !

---

## 🔧 Commandes de maintenance

```bash
# Redémarrer le backend après modification
pm2 restart cgs-backend

# Mettre à jour le frontend
cd /var/www/incubateur-cgs/frontend && npm run build

# Backup MariaDB
mysqldump -u cgs_user -p incubateur_cgs > backup_$(date +%Y%m%d).sql

# Voir les logs
pm2 logs cgs-backend
```
