-- Create UUID Migration Logs table for audit trail
CREATE TABLE IF NOT EXISTS public.uuid_migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_uuid UUID NOT NULL,
  new_uuid UUID NOT NULL,
  tables_affected TEXT[] DEFAULT '{}',
  records_migrated INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.uuid_migration_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view migration logs
CREATE POLICY "Only admins can view migration logs" ON public.uuid_migration_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policy: Only admins can insert migration logs
CREATE POLICY "Only admins can insert migration logs" ON public.uuid_migration_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for faster queries
CREATE INDEX idx_uuid_migration_logs_created_at ON public.uuid_migration_logs(created_at DESC);
CREATE INDEX idx_uuid_migration_logs_old_uuid ON public.uuid_migration_logs(old_uuid);
CREATE INDEX idx_uuid_migration_logs_new_uuid ON public.uuid_migration_logs(new_uuid);
