#!/bin/bash

# Hetzner Server Deployment Script
# Server: relay-scraper-node
# IP: 5.75.252.100

echo "🚀 Starting deployment to Hetzner server..."

# Configuration
HETZNER_IP="5.75.252.100"
HETZNER_USER="root"
SSH_PORT="22"
PROJECT_DIR="/var/www/relay"

echo "📡 Connecting to Hetzner server at ${HETZNER_IP}..."

# Execute deployment commands
ssh -p ${SSH_PORT} ${HETZNER_USER}@${HETZNER_IP} << 'REMOTE_EOF'
echo "✅ Connected to Hetzner server"
echo "📂 Navigating to project directory..."
cd /var/www/relay || { echo "❌ Project directory not found at /var/www/relay"; exit 1; }

echo "📥 Pulling latest changes from GitHub..."
git pull origin main || { echo "❌ Git pull failed"; exit 1; }

echo "📦 Installing/updating dependencies..."
npm install || { echo "❌ npm install failed"; exit 1; }

echo "🔨 Building frontend..."
npm run build || { echo "❌ Build failed"; exit 1; }

echo "🔄 Restarting PM2..."
pm2 restart all || { echo "❌ PM2 restart failed"; exit 1; }

echo "⏳ Waiting for server to start..."
sleep 5

echo "🔍 Checking server status..."
pm2 status

echo "📊 Checking recent logs..."
pm2 logs relay-backend --lines 20 --nostream

echo "✅ Deployment complete!"
REMOTE_EOF

if [ $? -eq 0 ]; then
    echo "✅ Deployment script executed successfully"
else
    echo "❌ Deployment failed"
    exit 1
fi