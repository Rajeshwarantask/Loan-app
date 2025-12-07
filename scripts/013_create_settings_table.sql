-- Create system_settings table for admin configurations
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - All users can view, only admins can manage
CREATE POLICY "All users can view settings" ON public.system_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default settings
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
  ('default_monthly_subscription', '2000', 'Default monthly subscription amount in rupees'),
  ('loan_issue_day', '11', 'Default day of month for loan issuance (1-31)'),
  ('loan_calculation_rule', 'dynamic', 'Loan duration calculation: fixed or dynamic')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index
CREATE INDEX idx_system_settings_key ON public.system_settings(setting_key);
