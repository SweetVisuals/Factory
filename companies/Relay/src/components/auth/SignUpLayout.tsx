import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Logo from '../Logo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/use-toast';
import { Github, Zap, AlertTriangle, Sparkles, Flame } from 'lucide-react';

const SignUpLayout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [fakeDecrease, setFakeDecrease] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const res = await fetch('/api/signup-count');
        const data = await res.json();
        setUserCount(data.spotsLeft || 900);
      } catch (e) {
        console.error('Error fetching user count:', e);
      }
    };
    fetchUserCount();
    const interval = setInterval(fetchUserCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Tiny local ticking down effect to make it feel extremely live & real-time
  useEffect(() => {
    const tick = setTimeout(() => {
      if (Math.random() > 0.7) {
        setFakeDecrease(prev => prev + 1);
      }
    }, 15000);
    return () => clearTimeout(tick);
  }, [fakeDecrease]);

  const spotsLeft = userCount;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast({ title: 'Terms Required', description: 'You must accept the Terms of Service and Privacy Policy to create an account.', variant: 'destructive' });
      return;
    }
    if (!email || !password) {
      toast({ title: 'Error', description: 'Please enter both email and password.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        // Decrement counter
        fetch('/api/increment-signup', { method: 'POST' }).catch(console.error);
        toast({ title: 'Success', description: 'Account created! Please check your email to verify your account or sign in.', duration: 5000 });
        navigate('/login');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'An error occurred during sign up.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    if (!acceptedTerms) {
      toast({ title: 'Terms Required', description: 'You must accept the Terms of Service and Privacy Policy to continue.', variant: 'destructive' });
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/verify`,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: 'Auth Error', description: err.message, variant: 'destructive' });
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col justify-center items-center bg-background text-foreground font-sans p-8 relative min-h-[calc(100vh-100px)]">
      <div className="w-full max-w-[420px] flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-2">
          <Logo />
          <p className="text-muted-foreground text-sm mt-2">
            Get started with email outreach automation
          </p>
        </div>

        {/* Real-time Limited Offer Banner */}
        <div className="bg-gradient-to-r from-purple-950/40 to-blue-950/40 border border-purple-500/30 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md shadow-lg animate-pulse-slow">
          <div className="absolute top-0 right-0 p-3 opacity-15">
            <Flame className="w-20 h-20 text-purple-400" />
          </div>
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400 animate-spin" /> LIMITED SIGNUP OFFER
              </span>
              <span className="text-[11px] font-black text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                {spotsLeft} SPOTS LEFT
              </span>
            </div>
            <h4 className="text-white font-extrabold text-sm mt-1">Get Free Premium Scraping Limits</h4>
            <p className="text-xs text-white/70 leading-relaxed">
              Sign up today and get <strong className="text-white font-bold">5,000 total free leads scraped</strong> and support for up to <strong className="text-white font-bold">5 total campaigns</strong> (with 2 concurrent campaigns).
            </p>
          </div>
        </div>

        <div className="w-full">
          <div className="flex items-start gap-3 mb-6 bg-secondary/30 p-4 rounded-xl border border-border/50">
            <input
              type="checkbox"
              id="terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-input text-primary focus:ring-primary focus:ring-offset-background bg-background cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
              I have read and agree to the <a href="/terms" target="_blank" className="text-foreground font-semibold hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" className="text-foreground font-semibold hover:underline">Privacy Policy</a>. I understand my responsibilities regarding data processing and anti-spam laws.
            </label>
          </div>

          <div className="flex gap-3 mb-6">
            <button 
              onClick={() => handleOAuth('google')}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-background border border-border text-foreground p-2.5 rounded-lg text-sm font-medium transition-all hover:bg-white/5 active:scale-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            
            <button 
              onClick={() => handleOAuth('github')}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-background border border-border text-foreground p-2.5 rounded-lg text-sm font-medium transition-all hover:bg-white/5 active:scale-95"
            >
              <Github size={18} />
              GitHub
            </button>
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Or sign up with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSignUp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoading}
                required
                className="bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                required
                className="bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-foreground text-background border-none rounded-lg p-2.5 text-sm font-semibold cursor-pointer transition-colors flex justify-center items-center mt-2 hover:bg-foreground/90 disabled:opacity-50"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-foreground font-semibold hover:underline"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignUpLayout;
