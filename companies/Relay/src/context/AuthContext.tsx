import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/auth/LoadingSpinner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: AuthError | null;
  needsOnboarding: boolean;
  signOut: () => Promise<void>;
  checkOnboardingStatus: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const navigate = useNavigate();

  const checkOnboardingStatus = async (userId: string) => {
    try {
      const { count } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      setNeedsOnboarding(count === 0);
    } catch (e) {
      console.error('Error checking onboarding status:', e);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout — if nothing resolves auth within 5s, stop loading anyway
    const safetyTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    // 1. First, handle any URL-based session tokens (email confirm links, magic links)
    const handleUrlSession = async () => {
      try {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token=') && hash.includes('refresh_token=')) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            window.location.hash = '';
            return; // onAuthStateChange will handle the rest
          }
        }

        const searchParams = new URLSearchParams(window.location.search);
        const accessTokenSearch = searchParams.get('access_token');
        const refreshTokenSearch = searchParams.get('refresh_token');
        if (accessTokenSearch && refreshTokenSearch) {
          await supabase.auth.setSession({
            access_token: accessTokenSearch,
            refresh_token: refreshTokenSearch
          });
          const url = new URL(window.location.href);
          url.searchParams.delete('access_token');
          url.searchParams.delete('refresh_token');
          window.history.replaceState({}, document.title, url.pathname + url.search);
          return; // onAuthStateChange will handle the rest
        }
      } catch (e) {
        console.error('Error handling URL session:', e);
      }
    };

    // 2. Listen for auth state changes — this is the SINGLE SOURCE OF TRUTH
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('[Auth] State change:', event, session?.user?.email || 'no user');
      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await checkOnboardingStatus(session.user.id);
      } else {
        setNeedsOnboarding(false);
      }
      
      clearTimeout(safetyTimeout);
      setLoading(false);
    });

    // 3. Handle URL tokens first, then let onAuthStateChange resolve everything
    handleUrlSession();

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/profile');
    } catch (err) {
      setError(err as AuthError);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, needsOnboarding, signOut, checkOnboardingStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
