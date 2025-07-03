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