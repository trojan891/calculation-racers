import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Mail,
  Sparkles,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { soundEngine } from '../lib/sound';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const getCleanAuthError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (
      raw.includes('auth/invalid-credential') ||
      raw.includes('auth/wrong-password') ||
      raw.includes('auth/user-not-found')
    ) {
      return 'Incorrect email or password. Please try again.';
    }
    if (raw.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (raw.includes('auth/weak-password')) {
      return 'Password must be at least 6 characters.';
    }
    if (raw.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (raw.includes('auth/popup-blocked')) {
      return 'Sign-in popup was blocked by browser. Please allow popups or use email sign-in.';
    }
    if (raw.includes('auth/network-request-failed')) {
      return 'Network connection issue. Please check your internet and try again.';
    }
    if (raw.includes('auth/too-many-requests')) {
      return 'Too many failed attempts. Please wait a moment before trying again.';
    }
    return 'Authentication could not be completed. Please try again.';
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      soundEngine.playSuccess();
      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMessage(getCleanAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const cleanNick = nickname.trim().slice(0, 20);
      if (cleanNick && userCred.user) {
        try {
          await updateProfile(userCred.user, { displayName: cleanNick });
        } catch {
          // ignore display name update error
        }
      }
      soundEngine.playSuccess();
      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMessage(getCleanAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address to receive reset instructions.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      soundEngine.playSuccess();
      setSuccessNotice('Password reset link sent! Check your inbox to set a new password.');
    } catch (err) {
      setErrorMessage(getCleanAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);
    soundEngine.playClick();
    try {
      await signInWithPopup(auth, googleProvider);
      soundEngine.playSuccess();
      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMessage(getCleanAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl sm:p-7">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onClose();
          }}
          className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-[#2563EB]">
            {mode === 'signup' ? (
              <UserPlus className="h-6 w-6" />
            ) : mode === 'forgot' ? (
              <KeyRound className="h-6 w-6" />
            ) : (
              <LogIn className="h-6 w-6" />
            )}
          </div>
          <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-slate-900">
            {mode === 'signup'
              ? 'Create Your Account'
              : mode === 'forgot'
                ? 'Reset Password'
                : 'Welcome Back'}
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {mode === 'signup'
              ? 'Save your trophies, records & join multiplayer matches'
              : mode === 'forgot'
                ? 'Enter your registered email to receive a password reset link'
                : 'Sign in to sync your high scores across devices'}
          </p>
        </div>

        {/* Google One-Click Auth */}
        {mode !== 'forgot' && (
          <div className="mt-5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex min-h-[46px] w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-slate-200" />
              <span className="absolute bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                or with email
              </span>
            </div>
          </div>
        )}

        {/* Success Notice */}
        {successNotice && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Error Notice */}
        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={
            mode === 'signup'
              ? handleEmailSignUp
              : mode === 'forgot'
                ? handlePasswordReset
                : handleEmailSignIn
          }
          className="space-y-3"
        >
          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                Display Name / Nickname
              </label>
              <div className="relative mt-1">
                <User className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. NitroSpeed"
                  maxLength={20}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-10 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-10 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessNotice(null);
                      setMode('forgot');
                    }}
                    className="text-[11px] font-bold text-[#2563EB] hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <KeyRound className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-10 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-2.5 right-3 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 min-h-[46px] w-full rounded-2xl bg-[#2563EB] py-3 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              'Processing...'
            ) : mode === 'signup' ? (
              'Create My Account'
            ) : mode === 'forgot' ? (
              'Send Password Reset Link'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Mode Toggle Footer */}
        <div className="mt-5 border-t border-slate-100 pt-4 text-center">
          {mode === 'signin' ? (
            <p className="text-xs font-semibold text-slate-600">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessNotice(null);
                  setMode('signup');
                }}
                className="font-extrabold text-[#2563EB] hover:underline"
              >
                Sign Up
              </button>
            </p>
          ) : mode === 'signup' ? (
            <p className="text-xs font-semibold text-slate-600">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessNotice(null);
                  setMode('signin');
                }}
                className="font-extrabold text-[#2563EB] hover:underline"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p className="text-xs font-semibold text-slate-600">
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessNotice(null);
                  setMode('signin');
                }}
                className="font-extrabold text-[#2563EB] hover:underline"
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
