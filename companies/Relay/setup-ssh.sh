#!/bin/bash

echo "🔐 Setting up SSH keys for Hetzner server..."

# Check if SSH key already exists
if [ -f ~/.ssh/id_ed25519 ]; then
    echo "✅ SSH key already exists at ~/.ssh/id_ed25519"
else
    echo "📝 Generating new SSH key..."
    ssh-keygen -t ed25519 -C "deploy@relay" -f ~/.ssh/id_ed25519 -N ""
fi

# Set correct permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub

echo "📋 Your public key:"
cat ~/.ssh/id_ed25519.pub

echo ""
echo "🚀 Copying key to Hetzner server..."
echo "You will be asked for your Hetzner password ONE TIME:"
echo "Password: Longlonglong1!"
echo ""

# Copy key to Hetzner
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@5.75.252.100

echo ""
echo "✅ SSH key setup complete!"
echo "Testing passwordless login..."
ssh -o StrictHostKeyChecking=no root@5.75.252.100 "echo '✅ Passwordless SSH working!' && pm2 status"
