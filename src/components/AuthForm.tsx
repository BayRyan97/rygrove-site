import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Loader2, User, ArrowLeft } from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'reset-password' | 'update-password';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>('signin');

  useEffect(() => {
    // Check if we're returning from a password reset
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    
    // Handle both hash-based and query param-based recovery
    if (hash.includes('type=recovery') || params.get('type') === 'recovery' || hash.includes('access_token')) {
      setMode('update-password');
      // Clean up the URL
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Listen for auth state changes to handle password recovery
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update-password');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFullName('');
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      switch (mode) {
        case 'signup': {
          const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName
              },
              emailRedirectTo: `${window.location.origin}`
            }
          });

          if (signUpError) throw signUpError;
          if (!data.user) throw new Error('Signup failed - please try again');
          break;
        }

        case 'signin': {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) throw signInError;
          if (!data.user) throw new Error('Sign in failed - please try again');
          break;
        }

        case 'reset-password': {
          // Use the current window location for the redirect
          const redirectTo = `${window.location.origin}`;

          const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectTo,
          });
          
          if (resetError) throw resetError;
          setSuccess('Password reset instructions have been sent to your email. Please check your inbox and click the link to reset your password.');
          break;
        }

        case 'update-password': {
          if (newPassword !== confirmPassword) {
            throw new Error('Passwords do not match');
          }
          
          if (newPassword.length < 6) {
            throw new Error('Password must be at least 6 characters long');
          }
          
          const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword
          });
          
          if (updateError) throw updateError;
          setSuccess('Password has been updated successfully. You can now sign in with your new password.');
          setTimeout(() => {
            setMode('signin');
            resetForm();
          }, 2000);
          break;
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed - please try again');
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    switch (mode) {
      case 'reset-password':
        return (
          <>
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
              Reset Password
            </h2>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
          </>
        );

      case 'update-password':
        return (
          <>
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
              Update Password
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newPassword">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password (min 6 characters)"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm new password"
                    minLength={6}
                    required
                  />
                </div>
              </div>
            </div>
          </>
        );

      default:
        return (
          <>
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
              {mode === 'signup' ? 'Create Account' : 'Employee Login'}
            </h2>
            
            {mode === 'signup' && (
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="fullName">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your full name"
                    required={mode === 'signup'}
                  />
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="bg-white shadow-xl rounded-2xl px-8 pt-6 pb-8 mb-4 card-hover">
        {(mode === 'reset-password' || mode === 'update-password') && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setMode('signin');
            }}
            className="mb-4 flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to login
          </button>
        )}
        
        {error && (
          <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 text-sm text-green-700 bg-green-100 rounded-lg">
            {success}
          </div>
        )}

        {renderForm()}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
              {mode === 'reset-password' ? 'Sending reset instructions...' :
               mode === 'update-password' ? 'Updating password...' :
               mode === 'signup' ? 'Creating account...' : 'Signing in...'}
            </span>
          ) : (
            mode === 'reset-password' ? 'Send Reset Instructions' :
            mode === 'update-password' ? 'Update Password' :
            mode === 'signup' ? 'Create Account' : 'Sign In'
          )}
        </button>

        {mode === 'signin' && (
          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setMode('signup');
              }}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
            >
              Don't have an account? Sign up
            </button>
            <div>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setMode('reset-password');
                }}
                className="text-blue-500 hover:text-blue-600 text-sm font-medium"
              >
                Forgot your password?
              </button>
            </div>
          </div>
        )}

        {mode === 'signup' && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setMode('signin');
              }}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
            >
              Already have an account? Sign in
            </button>
          </div>
        )}
      </form>
    </div>
  );
}