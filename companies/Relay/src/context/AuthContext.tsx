import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const location = useLocation();

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
    const initAuth = async () => {
      // Fallback timeout to ensure we never get stuck on the loading spinner
      const safetyTimeout = setTimeout(() => {
        setLoading(false);
      }, 5000);

      try {
        // 1. Check hash parameters
        const hash = window.location.hash;
        if (hash && hash.includes('access_token=') && hash.includes('refresh_token=')) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            const { data } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            if (data?.session) {
              window.location.hash = '';
              setUser(data.session.user);
              await checkOnboardingStatus(data.session.user.id);
              clearTimeout(safetyTimeout);
              setLoading(false);
              return;
            }
          }
        }

        // 2. Check query parameters
        const searchParams = new URLSearchParams(window.location.search);
        const accessTokenSearch = searchParams.get('access_token');
        const refreshTokenSearch = searchParams.get('refresh_token');
        if (accessTokenSearch && refreshTokenSearch) {
          const { data } = await supabase.auth.setSession({
            access_token: accessTokenSearch,
            refresh_token: refreshTokenSearch
          });
          if (data?.session) {
            const url = new URL(window.location.href);
            url.searchParams.delete('access_token');
            url.searchParams.delete('refresh_token');
            window.history.replaceState({}, document.title, url.pathname + url.search);
            setUser(data.session.user);
            await checkOnboardingStatus(data.session.user.id);
            clearTimeout(safetyTimeout);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error('Error handling URL session:', e);
      }

      // Check active session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkOnboardingStatus(session.user.id);
        }
      } catch (e) {
        console.error('Error fetching session:', e);
      } finally {
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkOnboardingStatus(session.user.id);
      } else {
        setNeedsOnboarding(false);
      }
      setLoading(false); // Ensure loading is disabled on any auth state change
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
