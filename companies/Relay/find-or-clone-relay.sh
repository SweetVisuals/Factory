#!/bin/bash

echo "🔍 Finding or cloning Relay project on Hetzner..."

# Common locations to check
LOCATIONS=(
    "/var/www/relay"
    "/home/relay"
    "/opt/relay"
    "/root/relay"
    "/home/admin/relay"
    "/srv/relay"
)

echo "📂 Checking common locations..."
for loc in "${LOCATIONS[@]}"; do
    if [ -d "$loc" ]; then
        echo "✅ Found project at: $loc"
        cd "$loc"
        echo "📥 Pulling latest changes..."
        git pull origin main
        echo "✅ Project updated!"
        exit 0
    fi
done

echo "❌ Project not found in common locations"
echo ""
echo "📋 Searching for any relay-related directories..."
find / -type d -name "*relay*" 2>/dev/null | head -10

echo ""
echo "📋 Searching for any node.js projects..."
find /home /root /var/www /opt -name "package.json" -type f 2>/dev/null | head -10

echo ""
echo "🔄 Cloning project from GitHub..."
echo "Please enter the directory where you want to clone:"
echo "Example: /var/www or /home/root or /opt"
read -p "Directory path: " CLONE_DIR

if [ -z "$CLONE_DIR" ]; then
    CLONE_DIR="/var/www"
fi

echo "📥 Cloning to $CLONE_DIR/relay..."
cd "$CLONE_DIR"
git clone https://github.com/SweetVisuals/Factory.git relay

echo "✅ Project cloned!"
cd relay
echo "📂 Navigating to companies/Relay..."
cd companies/Relay

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building frontend..."
npm run build

echo "✅ Setup complete!"
echo "📍 Project location: $(pwd)"