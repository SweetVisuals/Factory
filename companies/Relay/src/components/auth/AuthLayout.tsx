import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Logo from '../Logo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/use-toast';
import { Github, Zap } from 'lucide-react';

const AuthLayout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: 'Error', description: 'Please enter both username and password.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const email = username.toLowerCase().trim();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Signed in successfully!' });
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'An error occurred during sign in.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col justify-center items-center bg-background text-foreground font-sans p-8 relative min-h-[calc(100vh-100px)]">
      <div className="w-full max-w-[420px] flex flex-col gap-8">
        <div className="text-center flex flex-col items-center gap-2">
          <Logo />
          <p className="text-muted-foreground text-sm mt-2">
            Sign in to your account
          </p>
        </div>

        <div className="w-full">
          
          <div className="flex gap-3 mb-6">
            <div className="relative group flex-1">
              <button 
                disabled 
                className="w-full flex items-center justify-center gap-2 bg-background border border-border text-foreground p-2.5 rounded-lg text-sm font-medium cursor-not-allowed transition-colors hover:bg-muted"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold py-1 px-3 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm">
                COMING SOON
              </div>
            </div>
            
            <div className="relative group flex-1">
              <button 
                disabled 
                className="w-full flex items-center justify-center gap-2 bg-background border border-border text-foreground p-2.5 rounded-lg text-sm font-medium cursor-not-allowed transition-colors hover:bg-muted"
              >
                <Github size={18} />
                GitHub
              </button>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold py-1 px-3 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm">
                COMING SOON
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Or continue with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Username or Email</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@company.com"
                disabled={isLoading}
                className="bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-foreground">Password</label>
                <a href="#" className="text-primary text-sm font-medium hover:underline">Forgot?</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-foreground text-background border-none rounded-lg p-2.5 text-sm font-semibold cursor-pointer transition-colors flex justify-center items-center mt-2 hover:bg-foreground/90 disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

        </div>

        <div className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="text-foreground font-semibold hover:underline"
          >
            Create an account
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
