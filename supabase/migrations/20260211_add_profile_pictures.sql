-- Add profile picture support to profiles table
-- Stores profile picture URL and crop/zoom metadata

ALTER TABLE profiles
ADD COLUMN profile_picture_url TEXT,
ADD COLUMN picture_metadata JSONB DEFAULT '{"zoom": 1, "offsetX": 0, "offsetY": 0}'::jsonb;

-- Create avatars storage bucket (this would be done via Supabase dashboard or CLI)
-- INSERT into storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- RLS policies for avatars bucket:
-- Users can upload to their own avatar folder
-- Users can delete their own avatar
-- Public read access to avatars
-- These policies are defined in the Supabase dashboard under Storage > avatars
