-- Script to update existing users with V-format member IDs (V1, V2, V3...)
-- This ensures all members have readable member IDs

-- Update existing profiles with V-format member IDs based on creation order
WITH numbered_profiles AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM profiles
  WHERE member_id IS NULL OR member_id NOT LIKE 'V%'
)
UPDATE profiles
SET member_id = 'V' || numbered_profiles.row_num
FROM numbered_profiles
WHERE profiles.id = numbered_profiles.id;

-- Display updated member IDs for verification
SELECT id, full_name, email, member_id, created_at
FROM profiles
ORDER BY created_at ASC;
