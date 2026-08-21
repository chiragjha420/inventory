'use strict';
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Lock, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setHasSession(true);
        } else {
          setHasSession(false);
        }
      } catch (err) {
        console.error(err);
        setHasSession(false);
      } finally {
        setSessionChecked(true);
      }
    }
    checkSession();
  }, [supabase]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error('Please enter both password fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message || 'Failed to update password');
      } else {
        toast.success('Password updated successfully!');
        router.refresh();
        router.push('/admin');
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-neutral-50">
        <Loader2 className="animate-spin h-8 w-8 text-neutral-500" />
        <p className="mt-2 text-sm text-neutral-500">Checking session details...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-neutral-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-4xl font-bold tracking-tight text-neutral-900">
          📦 Godown
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-neutral-900">
          Reset Password
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-600">
          Set a secure new password for your admin account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-4 shadow-sm border border-neutral-200/80 rounded-xl sm:px-10">
          {!hasSession ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center text-red-500">
                <AlertCircle className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900">Invalid Session</h3>
              <p className="text-sm text-neutral-600">
                You do not have a valid password reset session. Please request a new recovery link from the login page.
              </p>
              <div className="pt-4">
                <Link
                  href="/admin/login"
                  className="inline-flex items-center text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handlePasswordUpdate}>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-neutral-700">
                  New Password
                </label>
                <div className="mt-2 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-neutral-400" />
                  </div>
                  <input
                    id="new-password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg bg-neutral-50/50 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-new-password" className="block text-sm font-medium text-neutral-700">
                  Confirm New Password
                </label>
                <div className="mt-2 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-neutral-400" />
                  </div>
                  <input
                    id="confirm-new-password"
                    name="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg bg-neutral-50/50 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-neutral-900 hover:bg-neutral-850 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
