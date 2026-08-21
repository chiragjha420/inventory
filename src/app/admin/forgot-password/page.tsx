'use strict';
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClient();

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/reset-password`,
      });

      if (error) {
        toast.error(error.message || 'Failed to send password reset email');
      } else {
        setSubmitted(true);
        toast.success('Reset link sent successfully!');
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-neutral-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-4xl font-bold tracking-tight text-neutral-900">
          📦 Godown
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-neutral-900">
          Forgot Password
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-600">
          We will send a password reset link to your email address
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-4 shadow-sm border border-neutral-200/80 rounded-xl sm:px-10">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center text-emerald-500">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900">Check your inbox</h3>
              <p className="text-sm text-neutral-600">
                We've sent a password reset link to <strong className="text-neutral-900">{email}</strong>.
                Follow the instructions in the email to set a new password.
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
            <form className="space-y-6" onSubmit={handleResetRequest}>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-neutral-700">
                  Email Address
                </label>
                <div className="mt-2 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-neutral-400" />
                  </div>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg bg-neutral-50/50 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base transition-colors"
                    placeholder="admin@godown.com"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-neutral-900 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center pt-2">
                <Link
                  href="/admin/login"
                  className="inline-flex items-center text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
