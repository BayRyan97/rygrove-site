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

export async function uploadProfilePicture(
  file: File,
  userId: string,
  metadata: PictureMetadata
) {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}-${file.name}`;

    // Upload to avatars bucket
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: false });

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

    if (updateError) throw updateError;

    return { success: true, publicUrl, metadata };
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
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(-2).join('/'); // Get user_id/filename

      await supabase.storage.from('avatars').remove([filePath]);
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