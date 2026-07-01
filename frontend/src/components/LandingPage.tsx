import React, { useState } from 'react';
import { supabase } from '../supabase';
import { emitToast } from '../utils/events';

interface LandingPageProps {
  onSignInSuccess: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSignInSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      emitToast('Please enter both username and password.', 'error');
      return;
    }

    setIsLoading(true);
    // Map "admin" and "admin@factory.com" to "ptnmgmt@gmail.com"
    const normalizedUsername = username.toLowerCase().trim();
    const email = (normalizedUsername === 'admin' || normalizedUsername === 'admin@factory.com') 
      ? 'ptnmgmt@gmail.com' 
      : username;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        emitToast(error.message, 'error');
      } else {
        emitToast('Signed in successfully!', 'success');
        onSignInSuccess();
      }
    } catch (err: any) {
      emitToast(err.message || 'An error occurred during sign in.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Dynamic Background Glows */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '5%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '2rem 4rem',
        zIndex: 10,
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(9, 13, 22, 0.7)',
        position: 'sticky',
        top: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6, #10b981)',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)'
          }} />
          <span style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            letterSpacing: '2px',
            background: 'linear-gradient(90deg, #f8fafc, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>PTN FACTORY</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s', fontSize: '1rem', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>Features</a>
          <a href="#about" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s', fontSize: '1rem', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>About</a>
        </div>
      </header>

      {/* Hero and Sign In section */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '4rem',
        padding: '4rem',
        maxWidth: '1400px',
        margin: '0 auto',
        alignItems: 'center',
        zIndex: 1
      }}>
        {/* Left column: Hero copy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1rem',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '999px',
            width: 'fit-content'
          }}>
            <span style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: 600, letterSpacing: '1px' }}>NEXT GENERATION B2B OUTREACH</span>
          </div>

          <h1 style={{
            fontSize: '4.5rem',
            fontWeight: 800,
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: '-2px'
          }}>
            Deploy autonomous <br/>
            <span style={{
              background: 'linear-gradient(90deg, #3b82f6, #10b981)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>agent networks</span>.
          </h1>

          <p style={{
            fontSize: '1.2rem',
            lineHeight: '1.7',
            color: '#94a3b8',
            margin: 0,
            maxWidth: '540px'
          }}>
            Scale your sales and business development tasks with a swarm of specialized AI agents. Automate custom scrapers, construct multi-step warmups, and control your workflow seamlessly.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>15</div>
              <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.3rem' }}>Active Outreach Campaigns</div>
            </div>
            <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#3b82f6' }}>10k+</div>
              <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.3rem' }}>B2B Prospects Engaged</div>
            </div>
          </div>
        </div>

        {/* Right column: Sign In card */}
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.3)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '3rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem'
        }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Sign in to Factory</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginTop: '0.5rem', margin: 0 }}>
              Enter your credentials below to access the command deck. <span style={{ color: '#3b82f6', fontSize: '0.8rem' }}>(Build v1.0.4 - Active)</span>
            </p>
          </div>

          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>USERNAME OR EMAIL</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                disabled={isLoading}
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1rem',
                  fontSize: '1rem',
                  color: '#fff',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1rem',
                  fontSize: '1rem',
                  color: '#fff',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '1.2rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              {isLoading ? 'Connecting...' : 'Access Command Deck'}
            </button>
          </form>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.1)',
            borderRadius: '12px'
          }}>
            <span style={{ fontSize: '1.2rem' }}>💡</span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
              To login as admin, use username <strong style={{ color: '#fff' }}>admin</strong> and password <strong style={{ color: '#fff' }}>admin123</strong>.
            </span>
          </div>
        </div>
      </main>

      {/* Features Grid Section */}
      <section id="features" style={{
        padding: '6rem 4rem',
        backgroundColor: '#070a11',
        borderTop: '1px solid rgba(255,255,255,0.03)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>Specialized Operations Control</h2>
            <p style={{ color: '#94a3b8', marginTop: '1rem' }}>Control different divisions of the outreach agency ecosystem.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.05)', padding: '2.5rem', borderRadius: '16px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>🏢</div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 1rem 0' }}>PTN Headquarters</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>Manage core workflows, view agent tasks, monitor system events, and direct the boss agent.</p>
            </div>
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.05)', padding: '2.5rem', borderRadius: '16px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>🔀</div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Relay Solutions</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>Deploy web scrapers, organize custom lists, validate contacts, and configure multi-step cold email campaigns.</p>
            </div>
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.05)', padding: '2.5rem', borderRadius: '16px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>📅</div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Agent Scheduler</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>Auto-curate target content, run Pinterest scrapers, structure accounts, and automate queue execution.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '3rem 4rem',
        borderTop: '1px solid rgba(255,255,255,0.03)',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.9rem'
      }}>
        &copy; {new Date().getFullYear()} PTN Factory. All rights reserved. Built for elite enterprise automation.
      </footer>
    </div>
  );
};

export default LandingPage;
