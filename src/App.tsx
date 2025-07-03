import React, { useEffect, useState } from 'react';
import { AuthForm } from './components/AuthForm';
import { supabase } from './lib/supabase';
import { Dashboard } from './components/Dashboard';
import type { User } from '@supabase/supabase-js';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check current auth status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {!user ? (
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">RYGROVE</h1>
            <AuthForm />
          </div>
        </div>
      ) : (
        <Dashboard user={user} />
      )}
    </div>
  );
}

export default App