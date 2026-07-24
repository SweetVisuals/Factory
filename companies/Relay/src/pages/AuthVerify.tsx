import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Layout from '../components/layout/Layout';

export default function AuthVerify() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // If the auth context is done loading and we have a user, it's successful!
    if (!loading) {
      if (user) {
        setStatus('success');
        // Wait a brief moment so they see the success state before redirecting
        const timer = setTimeout(() => {
          navigate('/onboarding');
        }, 1500);
        return () => clearTimeout(timer);
      } else {
        // If there's no user and we're not loading, maybe the token was invalid or expired
        setStatus('error');
        setErrorMessage('Verification link is invalid or has expired. Please try signing in or request a new link.');
      }
    }
  }, [loading, user, navigate]);

  return (
    <Layout>
      <div className="w-full h-full min-h-[calc(100vh-100px)] flex items-center justify-center p-4 relative">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-10 flex flex-col items-center justify-center text-center">
          
          {status === 'verifying' && (
            <>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mb-6">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-2">Verifying Email</h2>
              <p className="text-muted-foreground text-sm">Please wait while we verify your secure link...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30 mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-2">Email Verified!</h2>
              <p className="text-muted-foreground text-sm">Redirecting you to setup...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30 mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-2">Verification Failed</h2>
              <p className="text-muted-foreground text-sm mb-6">{errorMessage}</p>
              <button 
                onClick={() => navigate('/login')}
                className="bg-white text-black px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[11px] hover:scale-105 transition-all"
              >
                Go to Login
              </button>
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}
