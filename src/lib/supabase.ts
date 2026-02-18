import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: localStorage,
    storageKey: 'supabase.auth.token'
  }
});

// Function to clear all user data
export async function clearAllUserData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to clear data');

  try {
    // Delete expenses first (due to foreign key constraints)
    await supabase
      .from('expenses')
      .delete()
      .eq('user_id', user.id);

    // Delete time entries
    await supabase
      .from('time_entries')
      .delete()
      .eq('user_id', user.id);

    // Delete profile
    await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    // Delete auth user
    await supabase.auth.admin.deleteUser(user.id);

    // Sign out
    await supabase.auth.signOut();

    return { success: true };
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

// Add a helper function to check user roles
export async function getUserRole(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user role:', error);
    return null;
  }

  return profile?.role || null;
}

// Profile picture helpers
export interface PictureMetadata {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

// Helper function to delete old profile picture from storage
async function deleteOldProfilePicture(userId: string) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', userId)
      .single();

    if (profile?.profile_picture_url) {
      const url = new URL(profile.profile_picture_url);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/avatars\/(.+)$/);
      if (match?.[1]) {
        await supabase.storage.from('avatars').remove([match[1]]);
      }
    }
  } catch (error) {
    // Silently fail - old file deletion shouldn't block upload
    console.warn('Failed to delete old profile picture:', error);
  }
}

export async function uploadProfilePicture(
  file: File,
  userId: string,
  metadata: PictureMetadata
) {
  try {
    // Delete old profile picture first to prevent orphaned files
    await deleteOldProfilePicture(userId);

    // Generate unique filename
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}-${file.name}`;

    // Upload to avatars bucket
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: false, contentType: file.type, cacheControl: '3600' });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Update profile with picture URL and metadata
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        profile_picture_url: publicUrl,
        picture_metadata: metadata
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error details:', {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint
      });
      throw updateError;
    }

    return { success: true, publicUrl, metadata, timestamp };
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    throw error;
  }
}

export async function deleteProfilePicture(userId: string) {
  try {
    // Get current profile to find old picture path
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage if picture exists
    if (profile?.profile_picture_url) {
      const url = new URL(profile.profile_picture_url);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/avatars\/(.+)$/);
      if (match?.[1]) {
        await supabase.storage.from('avatars').remove([match[1]]);
      }
    }

    // Clear profile picture data
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        profile_picture_url: null,
        picture_metadata: { zoom: 1, offsetX: 0, offsetY: 0 }
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    throw error;
  }
}

// Helper function to update profile picture metadata (zoom/position)
export async function updateProfilePictureMetadata(
  userId: string,
  metadata: PictureMetadata
) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ picture_metadata: metadata })
      .eq('id', userId);

    if (error) throw error;

    return { success: true, metadata };
  } catch (error) {
    console.error('Error updating picture metadata:', error);
    throw error;
  }
}