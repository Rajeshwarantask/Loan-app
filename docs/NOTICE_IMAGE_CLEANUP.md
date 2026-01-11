# Notice Image Auto-Cleanup

This document explains how to set up automated deletion of notice images older than 1 month.

## Setup Options

### Option 1: Vercel Cron Jobs (Recommended)

1. Add a `CRON_SECRET` environment variable to your Vercel project
2. Add the following to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-old-notice-images",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This will run the cleanup daily at 2 AM UTC.

### Option 2: External Cron Service

Use a service like cron-job.org or EasyCron to call the cleanup endpoint:

- URL: `https://your-domain.com/api/cron/cleanup-old-notice-images`
- Method: GET
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`
- Schedule: Daily

### Option 3: Supabase pg_cron Extension

If you have access to pg_cron extension in Supabase:

```sql
-- Enable extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM
SELECT cron.schedule(
  'delete-old-notice-images',
  '0 2 * * *',
  'SELECT delete_old_notice_images()'
);
```

## How It Works

1. The system scans for notices older than 1 month that have images
2. For each old notice:
   - Deletes the image file from Supabase Storage
   - Updates the notice record to remove image_url and image_path
3. Returns a summary of deleted images

## Manual Cleanup

To manually trigger cleanup, call the API endpoint with proper authorization:

```bash
curl -X GET https://your-domain.com/api/cron/cleanup-old-notice-images \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Storage Policy

Images are stored in the `notice-images` bucket with these policies:
- Admins can upload (INSERT)
- Everyone can view (SELECT - public)
- Admins can delete (DELETE)

## Monitoring

Check the cleanup logs in your Vercel deployment logs or use the response from the API endpoint to monitor deleted images count.
