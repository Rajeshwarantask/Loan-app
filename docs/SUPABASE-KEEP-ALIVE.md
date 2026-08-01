# Supabase Keep-Alive Solution

## Problem

Supabase automatically pauses projects after ~1 week of inactivity. This causes slow cold starts when users return to the application.

## Solution Overview

We use GitHub Actions to call a health check endpoint every 3 days, which registers activity with Supabase and prevents it from pausing.

---

## Implementation Details

### 1. Health Check Endpoint

**Location:** `app/api/health/route.ts`

The endpoint:
- Does NOT require user authentication
- Performs a lightweight Supabase query to register activity
- Is secured using a custom `x-cron-secret` header
- Returns a simple JSON response

**How it works:**
```typescript
// Validates x-cron-secret header
const cronSecret = request.headers.get("x-cron-secret")
if (cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

// Performs lightweight RPC call
const { data, error } = await supabase.rpc("get_opening_balance", {...})

// Returns success status
return NextResponse.json({ status: "ok", timestamp })
```

### 2. GitHub Actions Workflow

**Location:** `.github/workflows/keep-supabase-active.yml`

The workflow:
- Runs automatically every 3 days (on days 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31)
- Can also be triggered manually from the Actions tab
- Calls the health check endpoint with the secret header
- Optionally sends Slack notifications on success/failure

---

## Setup Instructions

### Step 1: Add GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

#### Secret 1: `CRON_SECRET`
- **Name:** `CRON_SECRET`
- **Value:** Generate a strong random string (at least 32 characters)
  ```bash
  # Generate one:
  openssl rand -base64 32
  ```
- Click **Add secret**

#### Secret 2: `HEALTH_CHECK_URL`
- **Name:** `HEALTH_CHECK_URL`
- **Value:** Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
- Click **Add secret**

#### Secret 3: `SLACK_WEBHOOK_URL` (Optional)
- **Name:** `SLACK_WEBHOOK_URL`
- **Value:** Your Slack incoming webhook URL (for notifications)
- Click **Add secret**

### Step 2: Add Vercel Environment Variable

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `CRON_SECRET`
   - **Value:** Use the SAME value as the GitHub Secret
   - **Environments:** Select all (Production, Preview, Development)
   - Click **Save**

### Step 3: Verify Configuration

1. Go to your repository → **Actions** tab
2. Look for **Keep Supabase Active** workflow
3. Click **Run workflow** → **Run workflow** to test immediately
4. After ~10 seconds, you should see:
   - ✅ Green checkmark if successful
   - ❌ Red X if there's an issue

### Step 4: Check Logs

1. Click on the workflow run
2. Click on the **health-check** job
3. Click on **Call health check endpoint** step
4. You should see:
   ```
   HTTP Status: 200
   Response: {"status":"ok","timestamp":"..."}
   ✅ Health check successful - Supabase activity registered
   ```

---

## How It Works

### The Flow

```
GitHub Actions (every 3 days)
         ↓
Sends GET request to /api/health
         ↓
Includes x-cron-secret header
         ↓
Next.js API validates secret
         ↓
Executes Supabase query
         ↓
Supabase registers activity
         ↓
Project doesn't pause ✓
```

### Why Every 3 Days?

Supabase pauses after ~7 days of no activity. Calling the endpoint every 3 days ensures:
- **Safety margin:** 4+ days between checks (more than enough)
- **Efficient:** Not too frequent (reduces costs)
- **Distributed:** Spread across the month (not all on same day)

### Security

The solution is secure because:
1. The health check endpoint requires the `x-cron-secret` header
2. The secret is stored as:
   - GitHub Secret (not in code)
   - Vercel Environment Variable (not in code)
3. The endpoint doesn't expose any sensitive information
4. The RPC call uses dummy values (can't access real data)

---

## Environment Variables Required

```env
# Must be set in Vercel (and GitHub Secrets)
CRON_SECRET=your-secret-here

# GitHub Secrets only (not needed in Vercel)
HEALTH_CHECK_URL=https://your-app.vercel.app
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... (optional)
```

---

## Troubleshooting

### Issue: GitHub Actions workflow fails with "401 Unauthorized"

**Solution:**
1. Check that `CRON_SECRET` is set in both GitHub Secrets AND Vercel
2. Make sure the values are IDENTICAL
3. Redeploy your Vercel project after adding the env var
4. Test with `Run workflow` button

### Issue: Workflow shows "Health check not properly configured"

**Solution:**
1. The `CRON_SECRET` environment variable is missing in Vercel
2. Go to Vercel project → Settings → Environment Variables
3. Add `CRON_SECRET` with the same value as your GitHub Secret
4. Redeploy

### Issue: "Cannot GET /api/health"

**Solution:**
1. Make sure `app/api/health/route.ts` exists
2. Deploy the latest code to Vercel
3. Test by visiting: `https://your-app.vercel.app/api/health`
   - Should return 401 (no secret header)
4. Test with secret: 
   ```bash
   curl -H "x-cron-secret: your-secret" https://your-app.vercel.app/api/health
   ```
   - Should return 200

### Issue: Slack notifications not sending

**Solution:**
1. This is optional - the health check will still work without it
2. To enable: Add `SLACK_WEBHOOK_URL` to GitHub Secrets
3. Get a webhook URL from: Slack App → Incoming Webhooks
4. Format: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`

---

## Testing

### Manual Test via GitHub Actions

1. Go to your repository → **Actions**
2. Click **Keep Supabase Active** workflow
3. Click **Run workflow** → **Run workflow**
4. Wait ~30 seconds for it to complete
5. Should show ✅ success

### Manual Test via curl

```bash
# Test without secret (should fail)
curl https://your-app.vercel.app/api/health

# Test with secret (should succeed)
curl -H "x-cron-secret: your-secret" https://your-app.vercel.app/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-...","message":"Supabase connection verified..."}
```

---

## Improvements & Best Practices

### Already Implemented

✅ Header validation (no hardcoded routes)  
✅ Error handling with detailed logging  
✅ Non-intrusive query (dummy values, won't affect data)  
✅ Follows existing cron pattern in your codebase  
✅ Optional Slack notifications  
✅ Manual workflow trigger for testing  

### Future Enhancements

- Add metrics collection (response times, success rates)
- Implement exponential backoff for failures
- Add multiple health check variants (different queries)
- Create Vercel Analytics dashboard for uptime monitoring

---

## Cost Impact

**GitHub Actions:** Free (included in free tier)  
**Vercel:** Minimal (one API call every 3 days)  
**Supabase:** Negligible (one lightweight query every 3 days)

Total monthly cost: ~**$0.00**

---

## Support & Debugging

### View Workflow Runs

1. Repository → **Actions** tab
2. Click **Keep Supabase Active**
3. View all workflow runs with timestamps and statuses

### View API Logs

1. Vercel Dashboard → Your Project
2. Click **Deployments** → Current deployment
3. Click **Runtime Logs**
4. Look for `[Health]` log entries

### Check Supabase Activity

1. Supabase Dashboard → Your Project
2. Go to **Database** → **Activity Monitor** (if available)
3. Should see periodic queries every 3 days

---

## FAQ

**Q: Will this charge me?**  
A: No. GitHub Actions is free, and one query every 3 days has negligible cost.

**Q: What if I'm on Supabase's paid plan?**  
A: The solution works the same. One query every 3 days won't impact your quotas.

**Q: Can I change the frequency?**  
A: Yes. Edit `.github/workflows/keep-supabase-active.yml` and change the cron schedule.

**Q: What if GitHub Actions is down?**  
A: The workflow will fail, but you can manually trigger it or access the app normally (though it might be slow if Supabase has paused).

**Q: Is the secret exposed?**  
A: No. GitHub Secrets are encrypted and never shown in logs or code.

---

## Summary

Your Supabase project will now stay active indefinitely with zero manual effort. GitHub Actions will automatically call the health check endpoint every 3 days, preventing the project from pausing and keeping your application fast for users.
