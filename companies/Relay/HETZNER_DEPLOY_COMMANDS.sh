#!/bin/bash
# Run these commands ON THE HETZNER SERVER

echo "📥 Cloning project..."
git clone https://github.com/SweetVisuals/Factory.git /var/www/relay

echo "📂 Navigating to project..."
cd /var/www/relay/companies/Relay

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building frontend..."
npm run build

echo "🔑 Adding GROQ_API_KEY..."
echo "GROQ_API_KEY=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" >> .env

echo "🚀 Starting PM2..."
pm2 start server/index.mjs --name relay-backend
pm2 save

echo "✅ Checking status..."
pm2 status
pm2 logs relay-backend --lines 20

echo "🎉 Deployment complete!"
