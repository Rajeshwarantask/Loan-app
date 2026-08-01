## Supabase Keep-Alive: Quick Setup (5 minutes)

### What This Does
Prevents Supabase from pausing your project by automatically pinging it every 3 days.

### Files Added
- `app/api/health/route.ts` - Health check endpoint
- `.github/workflows/keep-supabase-active.yml` - GitHub Actions workflow
- `docs/SUPABASE-KEEP-ALIVE.md` - Full documentation

---

## Setup Steps

### 1. Generate Secret (Copy the command output)
```bash
openssl rand -base64 32
```
Save this value - you'll need it in steps 2 & 3.

### 2. Add GitHub Secrets
1. Go to: GitHub → Your Repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these 3 secrets:

| Name | Value |
|------|-------|
| `CRON_SECRET` | Paste the value from step 1 |
| `HEALTH_CHECK_URL` | `https://your-app.vercel.app` |
| `SLACK_WEBHOOK_URL` | (Optional - your Slack webhook URL) |

### 3. Add Vercel Environment Variable
1. Go to: Vercel → Your Project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `CRON_SECRET`
   - **Value:** Paste the same value from step 1
   - **Environments:** All (Production, Preview, Development)
3. Click **Save**
4. **Important:** Redeploy your project (deploy again) for the env var to take effect

### 4. Test It
1. Go to: GitHub → Your Repo → **Actions** → **Keep Supabase Active**
2. Click **Run workflow** → **Run workflow**
3. Wait ~30 seconds
4. Should show ✅ **Green checkmark**
5. Click the run to see logs:
   ```
   HTTP Status: 200
   Response: {"status":"ok",...}
   ✅ Health check successful
   ```

---

## Done! 🎉

Your Supabase project will now:
- ✅ Stay active forever
- ✅ Never pause due to inactivity
- ✅ Automatically ping every 3 days
- ✅ Work without any manual intervention

**Next automatic run:** In 3 days at 9:00 UTC  
**View runs:** GitHub → Actions → Keep Supabase Active

---

## Troubleshooting

**Workflow fails with 401?**
- Check `CRON_SECRET` is identical in GitHub & Vercel
- Redeploy Vercel after adding env var

**Workflow fails with "not properly configured"?**
- Add `CRON_SECRET` to Vercel Environment Variables
- Redeploy Vercel

**Need to verify manually?**
```bash
curl -H "x-cron-secret: your-secret" https://your-app.vercel.app/api/health
```

---

## Full Details

See: `docs/SUPABASE-KEEP-ALIVE.md`
