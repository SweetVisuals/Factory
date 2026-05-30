import { useState, useEffect } from 'react';
import './index.css';
import { supabase } from './supabase';
import { emitToast } from './utils/events';

// Components
import Discover from './components/Discover';
import Profile from './components/Profile';
import Employees from './components/Employees';
import Dashboard from './components/Dashboard';

import CommandBar from './components/CommandBar';
import ChatLog from './components/ChatLog';
import ToastContainer from './components/ToastContainer';
import AgentModal from './components/AgentModal';
import BusinessOverview from './components/BusinessOverview';
import AgentSprite from './components/AgentSprite';
import JobQueue from './components/JobQueue';

function App() {
  const [activeOverlay, setActiveOverlay] = useState<'none' | 'discover' | 'dashboard' | 'profile' | 'employees' | 'queue' | 'business' | 'logs'>('none');
  const [activeRoom, setActiveRoom] = useState<'hq' | 'relay' | 'scheduler'>(() => {
    const path = window.location.pathname.replace('/', '');
    if (path === 'relay' || path === 'scheduler') return path;
    return 'hq';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && activeOverlay === 'none') {
      setActiveOverlay('dashboard');
    }
  }, [isMobile, activeOverlay]);

  // High contrast themes and readability modes
  const [theme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('openclaw-theme') as 'dark' | 'light') || 'dark';
  });
  const [simpleMode] = useState<boolean>(() => {
    return localStorage.getItem('openclaw-simple-mode') === 'true';
  });

  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await supabase.auth.signInWithPassword({
          email: 'ptnmgmt@gmail.com',
          password: 'Longlonglong1!'
        });
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('openclaw-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (simpleMode) {
      root.classList.add('simple-mode');
    } else {
      root.classList.remove('simple-mode');
    }
    localStorage.setItem('openclaw-simple-mode', String(simpleMode));
  }, [simpleMode]);

  useEffect(() => {
    // Update URL when room changes
    window.history.pushState(null, '', `/${activeRoom}`);
  }, [activeRoom]);

  const togglePause = async () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    
    if (newPausedState) {
      const time = new Date().toLocaleTimeString();
      emitToast(`FACTORY PAUSED AT ${time}`, 'error');
      
      await supabase.from('chat_logs').insert([{
        agent_name: 'SYSTEM',
        message: `FACTORY PAUSED AT ${time}. ALL TASKS HALTED.`
      }]);
      
      await supabase.from('tasks').insert([{
        description: 'SYSTEM COMMAND: PAUSE ALL FACTORY OPERATIONS IMMEDIATELY',
        status: 'pending',
        assigned_to: 'Boss'
      }]);
    } else {
      emitToast('FACTORY RESUMED', 'success');
      
      await supabase.from('chat_logs').insert([{
        agent_name: 'SYSTEM',
        message: 'FACTORY RESUMED. NORMAL OPERATIONS COMMENCING.'
      }]);
      
      await supabase.from('tasks').insert([{
        description: 'SYSTEM COMMAND: RESUME ALL FACTORY OPERATIONS',
        status: 'pending',
        assigned_to: 'Boss'
      }]);
    }
  };

  const changeRoom = (room: 'hq' | 'relay' | 'scheduler') => {
    if (room === activeRoom) return;
    
    setIsTransitioning(true);
    
    setTimeout(() => {
      setActiveRoom(room);
      
      setTimeout(() => {
        setIsTransitioning(false);
      }, 400);
    }, 300);
  };

  const toggleOverlay = (view: 'discover' | 'dashboard' | 'profile' | 'employees' | 'queue' | 'business' | 'logs') => {
    if (isMobile) {
      setActiveOverlay(view);
    } else {
      setActiveOverlay(prev => prev === view ? 'none' : view);
    }
  };

  return (
    <div className="fullscreen-container">
      <ToastContainer />
      <AgentModal />

      {/* Transition Overlay */}
      <div className={`transition-overlay ${isTransitioning ? 'active' : ''}`}>
        <div className="spinner-container">
          <div className="spinner-outer"></div>
        </div>
        <div className="loading-text">LOADING...</div>
      </div>
      
      {/* Fullscreen Map Layer - Hidden for Modern CRM Look */}
      <div className={`map-layer ${isTransitioning ? 'transitioning' : ''}`} style={{ opacity: 0.03, pointerEvents: 'none' }}>
        <img src="/pixel_isometric_floorplan_1778460917681.png" className={`office-bg hq ${activeRoom === 'hq' ? 'active' : ''}`} alt="HQ Background" />
        <img src="/relay_isometric_room.png" className={`office-bg relay ${activeRoom === 'relay' ? 'active' : ''}`} alt="Relay Background" />
        <img src="/scheduler_isometric_room.png" className={`office-bg scheduler ${activeRoom === 'scheduler' ? 'active' : ''}`} alt="Scheduler Background" />
        

        {/* HQ Room */}
        <div className={`room-container hq ${activeRoom === 'hq' ? 'active' : ''}`}>
          <img src="/pixel_desk_ne_1778461490416.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 10, pointerEvents: 'none' }} alt="Boss Desk" />
          <AgentSprite name="Boss" src="/pixel_boss_ne_1778461503541.png" zIndex={11} />
          
          <img src="/manager-desk.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 11, pointerEvents: 'none' }} alt="Manager Desk" />
          <AgentSprite name="Manager" src="/Manager-Idle-SittingAtChair.png" zIndex={12} />
          
          <img src="/market-research-desk.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 13, pointerEvents: 'none' }} alt="Market Research Desk" />
          <AgentSprite name="Market Researcher" src="/market-research-sprite-idle.png" zIndex={14} />

          <img src="/product-specialist-desk.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 15, pointerEvents: 'none' }} alt="Product Specialist Desk" />
          <AgentSprite name="Product Specialist" src="/product-specialist-sprite.png" zIndex={16} />

          <img src="/design-desk.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 17, pointerEvents: 'none' }} alt="Design Desk" />
          <AgentSprite name="Design Team" src="/design-sprite.png" zIndex={18} />

          <img src="/specialist-desk.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 19, pointerEvents: 'none' }} alt="Specialist Desk" />
          <AgentSprite name="Specialist" src="/specialist-sprite-idle.png" zIndex={20} />
        </div>

        {/* Relay Solutions Room */}
        <div className={`room-container relay ${activeRoom === 'relay' ? 'active' : ''}`}>
          <a 
            href={import.meta.env.VITE_RELAY_URL || "http://localhost:5174"} 
            target="_blank" 
            rel="noopener noreferrer"
            className="pixel-btn"
            style={{
              position: 'absolute',
              bottom: '3rem',
              right: '3rem',
              zIndex: 50,
              textDecoration: 'none',
              backgroundColor: 'var(--accent-color)',
              color: '#fff',
              fontSize: '1.1rem',
              padding: '0.8rem 1.5rem',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
              borderRadius: '8px'
            }}
          >
            ACCESS RELAY ↗
          </a>
          <img src="/market-research-desk-relay.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 10, pointerEvents: 'none' }} alt="Market Research Desk" />
          <AgentSprite name="Market Researcher" src="/market-researcher-relay-idle.png" zIndex={11} room="relay" />

          <img src="/scraper-desk-relay.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 14, pointerEvents: 'none' }} alt="Scraper Desk" />
          <AgentSprite name="Scraper" src="/scraper-sprite-relay.png" zIndex={15} room="relay" />

          <img src="/validator-desk-relay.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 16, pointerEvents: 'none' }} alt="Validator Desk" />
          <AgentSprite name="Validator" src="/validator-sprite-idle-relay.png" zIndex={17} room="relay" />

          <img src="/emailer-desk-relay.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 18, pointerEvents: 'none' }} alt="Emailer Desk" />
          <AgentSprite name="Emailer" src="/emailer-sprite-idle-relay.png" zIndex={19} room="relay" />
          
          {/* Sales Strategist */}
          <img src="/sales-specialist.png" className="worker-sprite pixel-art" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 20, pointerEvents: 'none' }} alt="Sales Strategist Desk" />
          <AgentSprite name="Sales Strategist" src="/sales-strategist-sprite-idle-relay.png" zIndex={21} room="relay" />
        </div>

        {/* Scheduler Room */}
        <div className={`room-container scheduler ${activeRoom === 'scheduler' ? 'active' : ''}`}>
          <a 
            href={import.meta.env.VITE_SCHEDULER_URL || "https://thelabel.vercel.app"} 
            target="_blank" 
            rel="noopener noreferrer"
            className="pixel-btn"
            style={{
              position: 'absolute',
              bottom: '3rem',
              right: '3rem',
              zIndex: 50,
              textDecoration: 'none',
              backgroundColor: 'var(--accent-color)',
              color: '#fff',
              fontSize: '1.1rem',
              padding: '0.8rem 1.5rem',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
              borderRadius: '8px'
            }}
          >
            ACCESS THE LABEL ↗
          </a>
          <AgentSprite 
            name="Scheduler Manager" 
            src="/scheduler_manager_agent.png" 
            zIndex={11} 
            room="scheduler" 
            isIsolated={true}
            deskSrc="/scheduler_desk.png"
          />
          <AgentSprite 
            name="Pinterest Curator" 
            src="/pinterest_scraper_agent.png" 
            zIndex={13} 
            room="scheduler" 
            isIsolated={true}
            deskSrc="/scheduler_desk.png"
          />
          <AgentSprite 
            name="Content Creator" 
            src="/optimizer_agent.png" 
            zIndex={15} 
            room="scheduler" 
            isIsolated={true}
            deskSrc="/scheduler_desk.png"
          />
          <AgentSprite 
            name="Account Manager" 
            src="/account_strategist_agent.png" 
            zIndex={17} 
            room="scheduler" 
            isIsolated={true}
            deskSrc="/scheduler_desk.png"
          />

          {/* Quick Access Queue Button for Scheduler Room */}
          <button 
            className="pixel-btn"
            style={{
              position: 'absolute',
              bottom: '3rem',
              left: '3rem',
              zIndex: 50,
              fontSize: '1rem',
              padding: '0.8rem 1.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              backgroundColor: 'var(--secondary-color)',
              color: 'var(--text-color)',
              borderRadius: '8px'
            }}
            onClick={() => toggleOverlay('queue')}
          >
            OPEN JOB QUEUE [LOGS]
          </button>
        </div>

      </div>

      {/* Floating UI Layer */}
      <div className="top-nav" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', backgroundColor: 'var(--secondary-color)', padding: '0.5rem', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '95vw' }}>
          <button className={`pixel-btn ${activeOverlay === 'discover' ? 'active' : ''}`} onClick={() => toggleOverlay('discover')} style={{ border: 'none', background: activeOverlay === 'discover' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none' }}>
            Discover
          </button>
          <button className={`pixel-btn ${activeOverlay === 'dashboard' ? 'active' : ''}`} onClick={() => toggleOverlay('dashboard')} style={{ border: 'none', background: activeOverlay === 'dashboard' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none' }}>
            Dashboard
          </button>
          <button className={`pixel-btn ${activeOverlay === 'profile' ? 'active' : ''}`} onClick={() => toggleOverlay('profile')} style={{ border: 'none', background: activeOverlay === 'profile' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none' }}>
            Profile
          </button>
          <button className={`pixel-btn ${activeOverlay === 'employees' ? 'active' : ''}`} onClick={() => toggleOverlay('employees')} style={{ border: 'none', background: activeOverlay === 'employees' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none' }}>
            Employees
          </button>
          <button className={`pixel-btn ${activeOverlay === 'queue' ? 'active' : ''}`} onClick={() => toggleOverlay('queue')} style={{ border: 'none', background: activeOverlay === 'queue' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none' }}>
            Queue
          </button>
          <button className={`pixel-btn ${activeOverlay === 'logs' ? 'active' : ''}`} onClick={() => toggleOverlay('logs')} style={{ border: 'none', background: activeOverlay === 'logs' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none' }}>
            Logs
          </button>
          <button className={`pixel-btn ${activeOverlay === 'business' ? 'active' : ''}`} onClick={() => toggleOverlay('business')} style={{ border: 'none', background: activeOverlay === 'business' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none' }}>
            Business
          </button>
        </div>
        {activeOverlay === 'none' && !isMobile && (
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--panel-bg)', padding: '0.5rem', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <button className={`pixel-btn ${activeRoom === 'hq' ? 'active' : ''}`} style={{ fontSize: '0.9rem', padding: '0.4rem 1rem', background: activeRoom === 'hq' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none', border: 'none' }} onClick={() => changeRoom('hq')}>
              PTN HQ
            </button>
            <button className={`pixel-btn ${activeRoom === 'relay' ? 'active' : ''}`} style={{ fontSize: '0.9rem', padding: '0.4rem 1rem', background: activeRoom === 'relay' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none', border: 'none' }} onClick={() => changeRoom('relay')}>
              Relay Solutions
            </button>
            <button className={`pixel-btn ${activeRoom === 'scheduler' ? 'active' : ''}`} style={{ fontSize: '0.9rem', padding: '0.4rem 1rem', background: activeRoom === 'scheduler' ? 'var(--btn-active-bg)' : 'transparent', boxShadow: 'none', border: 'none' }} onClick={() => changeRoom('scheduler')}>
              Scheduler
            </button>
          </div>
        )}
      </div>

      {/* Top Right Factory Pause Panel */}
      <div className="overwatch-panel" style={{
        backgroundColor: 'var(--panel-bg)',
        padding: '0.5rem',
        boxShadow: isPaused ? '4px 4px 0px #ef4444' : '4px 4px 0px var(--accent-color)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100, /* Float above all overlays */
        transition: 'all 0.2s ease',
        borderRadius: '0px'
      }}>
        <button 
          onClick={togglePause}
          style={{
            background: 'transparent',
            border: 'none',
            color: isPaused ? '#ef4444' : '#10b981',
            fontSize: '2rem',
            cursor: 'pointer',
            lineHeight: 1,
            padding: '0.2rem 0.5rem',
            textShadow: isPaused ? '0 0 10px rgba(239, 68, 68, 0.6)' : '0 0 10px rgba(16, 185, 129, 0.6)',
            transition: 'all 0.2s ease',
            transform: isPaused ? 'scale(1.1)' : 'scale(1)'
          }}
          title={isPaused ? "Resume Factory" : "Pause Factory"}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
      </div>

      {/* Only show the Boss Command Input when no overlays are open */}
      {activeOverlay === 'none' && !isMobile && (
        <>
          <div className="desktop-only">
            <CommandBar />
            <ChatLog />
          </div>
        </>
      )}

      {/* Overlay Panels */}
      <div className={`overlay-panel ${activeOverlay !== 'none' ? 'open' : ''}`}>
        {!isMobile && <button className="close-btn" onClick={() => setActiveOverlay('none')} style={{ fontFamily: 'Inter', fontWeight: 300 }}>✕</button>}
        
        <div className="overlay-content page-enter">
          {activeOverlay === 'discover' && <Discover />}
          {activeOverlay === 'dashboard' && <Dashboard />}
          {activeOverlay === 'profile' && <Profile />}
          {activeOverlay === 'employees' && <Employees />}

          {activeOverlay === 'queue' && <JobQueue />}
          {activeOverlay === 'business' && <BusinessOverview />}
          {activeOverlay === 'logs' && <ChatLog fullScreen={true} />}
        </div>
      </div>
    </div>
  );
}

export default App;
