# Push Notifications Setup Guide

This guide explains how to set up and configure push notifications for the Vizhuthugal Sangam PWA.

## Overview

The push notification system allows users to:
- Receive EMI due date reminders
- Get payment confirmation notifications
- Receive important account update alerts

## Components

### 1. Frontend Components

**`/lib/utils/push-notifications.ts`**
- `requestNotificationPermission()` - Request browser permission for notifications
- `subscribeToPushNotifications()` - Subscribe user to push notifications
- `unsubscribeFromPushNotifications()` - Unsubscribe user from push notifications
- `getPushSubscriptionStatus()` - Check if user is subscribed
- `savePushSubscription()` - Save subscription to backend
- `removePushSubscription()` - Remove subscription from backend

**`/components/settings/notification-preferences.tsx`**
- UI component for users to enable/disable notifications
- Displays notification types and status
- Handles subscription toggle

### 2. Backend API Routes

**`/app/api/notifications/subscribe/route.ts`**
- Saves push subscription to database
- Updates user notification preferences
- Endpoint: `POST /api/notifications/subscribe`

**`/app/api/notifications/unsubscribe/route.ts`**
- Removes push subscription from database
- Updates user notification preferences
- Endpoint: `POST /api/notifications/unsubscribe`

**`/app/api/notifications/send/route.ts`**
- Sends push notifications to subscribed users
- Handles multiple subscriptions
- Endpoint: `POST /api/notifications/send`

### 3. Service Worker

**`/public/sw.js`**
- `push` event handler - Receives and displays push notifications
- `notificationclick` event handler - Handles user clicks on notifications
- `notificationclose` event handler - Tracks when notifications are dismissed

### 4. Database

**`push_subscriptions` table**
- Stores user push subscriptions
- Includes endpoint, enabled status, and subscription data
- Has RLS policies for security

**`profiles` table**
- `notifications_enabled` column - Tracks user preference

## Setup Instructions

### 1. Generate VAPID Keys

Push notifications require VAPID keys for authentication. Generate them using:

```bash
# Using web-push npm package
npx web-push generate-vapid-keys
```

This will output:
```
Public Key: <VAPID_PUBLIC_KEY>
Private Key: <VAPID_PRIVATE_KEY>
```

### 2. Set Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your_public_key>
VAPID_PRIVATE_KEY=<your_private_key>
VAPID_EMAIL=your-email@example.com
```

The public key is needed for subscription (client-side).
The private key is needed for sending notifications (server-side).

### 3. Run Database Migration

Execute the migration to create the `push_subscriptions` table:

```sql
-- Run the migration from /scripts/62-create-push-subscriptions-table.sql
```

### 4. Install Web-Push Library (Production)

For production, install the `web-push` library to send notifications:

```bash
npm install web-push
```

Then update `/app/api/notifications/send/route.ts` to use it:

```typescript
import webpush from "web-push"

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// In the sendPushNotification function:
await webpush.sendNotification(subscription, JSON.stringify(message))
```

## Usage

### For Users

1. Go to Settings
2. Scroll to "Push Notifications" section
3. Click "Enable Notifications"
4. Grant browser permission when prompted
5. Notifications will be saved to your account

### For Developers (Sending Notifications)

Example API call to send a notification:

```typescript
const response = await fetch("/api/notifications/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "user-id",
    type: "emi_due",
    title: "EMI Due Reminder",
    body: "Your EMI of ₹5,000 is due tomorrow",
    data: {
      url: "/dashboard",
      icon: "/icon-192.png",
    },
  }),
})
```

### Automated EMI Reminders

To send automatic EMI reminders, set up a scheduled job (cron) that:

1. Finds users with due EMI payments
2. Checks if they have notifications enabled
3. Calls the `/api/notifications/send` endpoint

Example cron job logic:

```typescript
// Runs daily at 9 AM
const { data: loans } = await supabase
  .from("loans")
  .select("user_id, next_payment_date")
  .eq("status", "active")
  .lte("next_payment_date", tomorrow)

for (const loan of loans) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("notifications_enabled")
    .eq("id", loan.user_id)
    .single()

  if (profile.notifications_enabled) {
    await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: loan.user_id,
        type: "emi_due",
        title: "EMI Payment Due",
        body: "Your EMI payment is due soon. Please pay before the due date.",
        data: {
          url: "/dashboard",
        },
      }),
    })
  }
}
```

## Browser Support

Push notifications are supported in:
- Chrome/Edge 50+
- Firefox 48+
- Android Chrome
- Safari 16+ (macOS 13.1+)
- Samsung Internet

Not supported:
- Safari on iOS
- Opera on some platforms

## Security Considerations

1. **VAPID Keys**: Keep private key secure, never expose in client-side code
2. **Subscription Storage**: Encrypted in database with RLS policies
3. **User Control**: Users can disable notifications anytime
4. **Data Privacy**: Only store endpoint, not sensitive user data in notifications
5. **API Protection**: Protect `/api/notifications/send` with authentication in production

## Troubleshooting

### Notifications not showing?

1. Check browser permission granted
2. Verify service worker is registered
3. Check browser console for errors
4. Ensure VAPID keys are correctly set

### Subscription not saving?

1. Check network tab for API errors
2. Verify database migration ran
3. Check Supabase RLS policies
4. Review console logs

### Users can't enable notifications?

1. Ensure VAPID public key is set
2. Check service worker is active
3. Verify browser supports notifications
4. Check for permission denial

## Testing

You can test push notifications using the browser DevTools:

1. Open DevTools > Application > Service Workers
2. Check the service worker is active
3. Use Chrome's "Simulate push event" feature
4. Or manually trigger push with:

```javascript
// In browser console
navigator.serviceWorker.ready.then(reg => {
  reg.showNotification("Test Notification", {
    body: "This is a test notification",
    icon: "/icon-192.png"
  })
})
```
