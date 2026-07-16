# Deploy to Hetzner Server

## Prerequisites
- SSH access to Hetzner server
- PM2 installed on server
- Git repository cloned on server

## Deployment Steps

### 1. SSH into Hetzner server
```bash
ssh root@YOUR_HETZNER_IP
# or
ssh user@YOUR_HETZNER_IP
```

### 2. Navigate to the project directory
```bash
cd /path/to/your/project
# Common paths:
# /var/www/relay
# /home/user/relay
# /opt/relay
```

### 3. Pull latest changes from GitHub
```bash
git pull origin main
```

### 4. Install/update dependencies
```bash
npm install
```

### 5. Build the frontend
```bash
npm run build
```

### 6. Restart the server with PM2
```bash
pm2 restart all
# OR if you need to start it fresh:
pm2 start server/index.mjs --name relay-backend
```

### 7. Verify the deployment
```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs relay-backend --lines 50

# Verify the server is running
curl http://localhost:3001
```

## Important Files Changed
- server/ai-client.mjs - Groq-only AI client
- server/scraper.mjs - Enhanced research prompt
- server/scraper_scheduler_cron.mjs - Batch limit 20
- server/research_cron.mjs - NEW: Research automation
- server/index.mjs - Email filtering + research cron
- src/pages/Discover.tsx - Research filter
- .env - Add GROQ_API_KEY

## Environment Variables Required
Make sure your .env file on Hetzner has:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- GROQ_API_KEY (NEW - REQUIRED)
- PORT=3001
- ENABLE_CRONS=true
