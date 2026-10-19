#!/bin/bash
# ==============================================================================
# Script de mise à jour automatique sans interruption - Serveur HPE (Ubuntu)
# ==============================================================================

set -e

# Se placer dans le répertoire du projet
cd "$(dirname "$0")"

echo "========================================================"
echo "🚀 Mise à jour de l'application IDS sur le serveur HPE"
echo "========================================================"

# 1. Récupération des dernières modifications depuis GitHub
echo "📥 [1/4] Récupération des modifications depuis GitHub..."
git fetch origin main
git reset --hard origin/main

# 2. Vérification et installation des dépendances si nécessaire
echo "📦 [2/4] Vérification des dépendances (backend & frontend)..."
npm run install:all

# 3. Compilation optimisée du frontend React
echo "🏗️ [3/4] Compilation du frontend en production..."
npm run build

# 4. Redémarrage propre sans coupure via PM2
echo "🔄 [4/4] Rechargement de l'application avec PM2..."
if command -v pm2 >/dev/null 2>&1; then
  if pm2 list | grep -q "ids-app"; then
    pm2 reload ids-app --update-env
  else
    pm2 start backend/src/app.js --name "ids-app"
    pm2 save
  fi
else
  echo "⚠️ PM2 n'est pas installé globalement. Installez-le avec : npm install -g pm2"
fi

echo "========================================================"
echo "✅ Mise à jour terminée avec succès sur le serveur !"
echo "========================================================"
