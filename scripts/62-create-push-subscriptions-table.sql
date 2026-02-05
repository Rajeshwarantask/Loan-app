-- Create push_subscriptions table for storing push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  endpoint TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for user_id lookup
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_enabled ON push_subscriptions(enabled);

-- Add notifications_enabled column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT false;

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS push_subscriptions_users_select ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_users_insert ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_users_update ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_users_delete ON push_subscriptions;

CREATE POLICY push_subscriptions_users_select ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_users_insert ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_users_update ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_users_delete ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Allow admins to view all subscriptions
DROP POLICY IF EXISTS push_subscriptions_admin_select ON push_subscriptions;
CREATE POLICY push_subscriptions_admin_select ON push_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
