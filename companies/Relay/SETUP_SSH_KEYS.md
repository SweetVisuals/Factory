# Setup SSH Keys for Passwordless Deployment

## Why SSH Keys?
- More secure than passwords
- Allows automated deployments
- No need to type password every time

## Step-by-Step Setup

### 1. Check if you already have an SSH key

```bash
ls -la ~/.ssh/id_ed25519
# or
ls -la ~/.ssh/id_rsa
```

If you see a file like `id_ed25519` or `id_rsa`, you already have a key. Skip to Step 3.

### 2. Generate a new SSH key (if needed)

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

**Instructions:**
- Press Enter to accept default location (`/Users/Vuze/.ssh/id_ed25519`)
- Optionally add a passphrase (recommended for security)
- Press Enter to confirm

### 3. Copy your public key to Hetzner

```bash
ssh-copy-id root@5.75.252.100
```

**This will:**
- Ask for your Hetzner password **ONE LAST TIME**
- Copy your public key to the server
- Set up passwordless login

### 4. Test passwordless login

```bash
ssh root@5.75.252.100
```

**Expected result:** You should log in immediately without being asked for a password.

### 5. Run the deployment script

```bash
/Users/Vuze/Desktop/Factory/companies/Relay/deploy-to-hetzner.sh
```

## Troubleshooting

### If ssh-copy-id doesn't work:

```bash
# Manual method
cat ~/.ssh/id_ed25519.pub | ssh root@5.75.252.100 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

### If SSH still asks for password:

```bash
# Check permissions on your local SSH key
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub

# Check permissions on Hetzner
ssh root@5.75.252.100 "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

## Security Notes

1. **Never share your private key** (`id_ed25519` or `id_rsa`)
2. **Your public key** (`id_ed25519.pub`) is safe to share
3. **Change your Hetzner password** after setting up SSH keys:
   ```bash
   ssh root@5.75.252.100
   passwd
   ```

## Next Steps After SSH Setup

Once SSH keys are working, run the deployment:
```bash
/Users/Vuze/Desktop/Factory/companies/Relay/deploy-to-hetzner.sh
```

Then add the Groq API key to Hetzner's `.env` file and restart PM2.