# Hetzner SSH Troubleshooting Guide

## Problem: "Permission denied" when using password

## Solution 1: Try Different Usernames

Hetzner servers often use `root`, but sometimes they use a custom user. Try these:

```bash
# Try root
ssh root@5.75.252.100

# If that fails, try common Hetzner usernames
ssh admin@5.75.252.100
ssh ubuntu@5.75.252.100
ssh debian@5.75.252.100
ssh user@5.75.252.100
```

## Solution 2: Check Your Hetzner Email

Look for the **"Welcome to Hetzner"** email you received when you created the server. It contains:
- The correct username
- The initial password
- SSH instructions

**Search your email for:**
- Subject: "Your new server" or "Hetzner Server"
- Sender: `robot@robot.hetzner.com` or `noreply@hetzner.com`

## Solution 3: Use Hetzner Rescue System

If you can't remember the password:

1. Go to https://console.hetzner.com/
2. Select your server (5.75.252.100)
3. Click "Rescue" → "Enable rescue system"
4. Select "Linux" and choose a password
5. Click "Enable rescue system"
6. Reboot the server
7. SSH with the rescue password:
   ```bash
   ssh root@5.75.252.100
   # Use the rescue password you set
   ```

8. Once logged in, mount your filesystem and reset the password:
   ```bash
   # Find your disk
   lsblk
   
   # Mount it (usually /dev/sda1 or /dev/nvme0n1p1)
   mount /dev/sda1 /mnt
   
   # Reset the password for root or your user
   chroot /mnt passwd root
   # Enter new password twice
   
   # Disable rescue system
   reboot
   ```

## Solution 4: Check if SSH is Even Running

```bash
# Test if SSH port is open
telnet 5.75.252.100 22
# or
nc -zv 5.75.252.100 22
```

## Solution 5: Use Hetzner Cloud Console

If SSH still doesn't work:

1. Go to https://console.hetzner.com/
2. Select your server
3. Click "Console" (VNC/Serial console)
4. Log in with the rescue system or existing credentials
5. Fix the SSH configuration or reset passwords

## Quick Test

Try this command to see what username works:
```bash
ssh -v root@5.75.252.100
```

The `-v` flag shows verbose output and might reveal:
- Which usernames are being tried
- Why authentication is failing
- If the server is even accepting connections

## After You Gain Access

Once you can SSH in, run:
```bash
# Check current user
whoami

# Check if you're root
id

# Navigate to project
cd /var/www/relay

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build frontend
npm run build

# Restart PM2
pm2 restart all

# Check status
pm2 status
```

## Need Help?

If none of these work, you may need to:
1. Contact Hetzner support
2. Use the Hetzner Cloud Console (web-based SSH)
3. Reinstall the server (last resort)
