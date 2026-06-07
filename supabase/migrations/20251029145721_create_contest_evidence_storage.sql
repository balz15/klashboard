/*
  # Create Storage Bucket for Contest Evidence
  
  1. Storage Bucket
    - Create `contest-evidence` bucket for storing submission photos/videos
    - Enable public access for viewing evidence
  
  Note: Storage policies should be configured via Supabase Dashboard:
    - Allow authenticated users to upload to their own folders
    - Allow users to view evidence in contests they participate in
*/

-- Create the storage bucket for contest evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('contest-evidence', 'contest-evidence', true)
ON CONFLICT (id) DO NOTHING;