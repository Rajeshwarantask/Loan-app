-- Create storage bucket for notice images
INSERT INTO storage.buckets (id, name, public)
VALUES ('notice-images', 'notice-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users (admins) to upload images
CREATE POLICY "Admins can upload notice images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'notice-images'
  AND (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR 
       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
);

-- Allow everyone to view images (public read)
CREATE POLICY "Anyone can view notice images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'notice-images');

-- Allow admins to delete images
CREATE POLICY "Admins can delete notice images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'notice-images'
  AND (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR 
       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
);

-- Add image_url column to notices table
ALTER TABLE notices ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image_path column to track storage path for deletion
ALTER TABLE notices ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Create function to auto-delete old notice images (older than 1 month)
CREATE OR REPLACE FUNCTION delete_old_notice_images()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_notice RECORD;
  storage_path TEXT;
BEGIN
  -- Find notices older than 1 month with images
  FOR old_notice IN 
    SELECT id, image_path 
    FROM notices 
    WHERE image_path IS NOT NULL 
    AND created_at < NOW() - INTERVAL '1 month'
  LOOP
    -- Delete from storage
    IF old_notice.image_path IS NOT NULL THEN
      DELETE FROM storage.objects 
      WHERE bucket_id = 'notice-images' 
      AND name = old_notice.image_path;
      
      -- Clear image fields in notices table
      UPDATE notices 
      SET image_url = NULL, image_path = NULL 
      WHERE id = old_notice.id;
    END IF;
  END LOOP;
END;
$$;

-- Create a scheduled job to run the cleanup function daily
-- Note: This requires pg_cron extension. If not available, you can call this function via an API cron job
-- To enable pg_cron: run 'CREATE EXTENSION IF NOT EXISTS pg_cron;' as superuser
-- Then schedule: SELECT cron.schedule('delete-old-notice-images', '0 2 * * *', 'SELECT delete_old_notice_images()');

COMMENT ON FUNCTION delete_old_notice_images() IS 'Deletes notice images older than 1 month from storage';
