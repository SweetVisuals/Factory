import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api/api';
import { Brain, Terminal as TerminalIcon, Cpu, Zap, Activity, Shield, Database, Globe, Layers } from 'lucide-react';

const Hermes = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'hermes', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [status, setStatus] = useState({ status: 'offline', version: 'unknown' });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStatus();
    fetchSkills();
    setMessages([{ role: 'hermes', content: 'INITIALIZING HERMES OS v1.0.4...\nCONNECTING TO DEEPSEEK NEURAL LINK...\nSYSTEM ONLINE. READY FOR INSTRUCTIONS.' }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/hermes/status');
      if (res.data.success) setStatus(res.data);
    } catch (e) {}
  };

  const fetchSkills = async () => {
    try {
      const res = await api.get('/hermes/skills');
      if (res.data.success && typeof res.data.skills === 'string') {
        const skillList = res.data.skills.split('\n').filter((s: string) => s.includes('✓')).map((s: string) => s.trim());
        setSkills(skillList);
      }
    } catch (e) {}
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await api.post('/hermes/chat', { message: userMsg, yolo: true });
      if (res.data.success) {
        setMessages(prev => [...prev, { role: 'hermes', content: res.data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'hermes', content: `ERROR: ${res.data.error || 'Request Failed'}` }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'hermes', content: `CRITICAL SYSTEM ERROR: ${err.message}` }]);
    } finally {
      setIsTyping(false);
      fetchSkills(); // Refresh skills in case he learned something
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 lg:p-12 space-y-12 animate-in fade-in duration-1000">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black text-foreground uppercase tracking-tighter italic flex items-center gap-6 leading-none pixel-font animate-flicker">
            <Brain size={48} className="text-primary" />
            HERMES.CMD
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <div className={`px-4 py-1 rounded-none text-[10px] font-black uppercase tracking-widest ${status.status === 'online' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              ● {status.status}
            </div>
            <div className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.3em]">
              DeepSeek Neural Integration Active
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="p-6 rounded-none bg-foreground/[0.02] border-none flex flex-col items-end justify-center">
             <div className="text-[10px] font-black text-foreground/20 uppercase tracking-widest mb-1">Processing Power</div>
             <div className="text-2xl font-black text-foreground pixel-font">99.8%</div>
          </div>
          <div className="p-6 rounded-none bg-primary/10 border-none flex flex-col items-end justify-center">
             <div className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-1">Latency</div>
             <div className="text-2xl font-black text-primary pixel-font">14ms</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Terminal Window */}
        <div className="lg:col-span-2 group">
          <div className="relative rounded-none overflow-hidden bg-black/40 backdrop-blur-3xl shadow-2xl shadow-primary/5 retro-scanline h-[700px] flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5 pointer-events-none" />
            
            <div className="flex items-center justify-between px-8 py-4 bg-foreground/[0.03]">
               <div className="flex items-center gap-3">
                  <TerminalIcon size={14} className="text-primary" />
                  <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.4em]">Autonomous Terminal</span>
               </div>
               <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-none bg-red-500/20" />
                  <div className="w-2 h-2 rounded-none bg-yellow-500/20" />
                  <div className="w-2 h-2 rounded-none bg-green-500/20" />
               </div>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-none custom-scrollbar"
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] p-6 rounded-none pixel-font text-lg leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-foreground/[0.05] text-foreground rounded-tr-none' 
                      : 'bg-primary/10 text-primary rounded-tl-none'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-start">
                  <div className="bg-primary/10 text-primary p-6 rounded-none rounded-tl-none pixel-font text-lg animate-pulse">
                    HERMES IS THINKING...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="p-8 bg-foreground/[0.02]">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="ENTER COMMAND..."
                  className="w-full bg-foreground/[0.03] border-none text-foreground placeholder:text-foreground/10 rounded-none px-8 h-16 pixel-font text-xl focus:bg-foreground/[0.06] transition-all outline-none"
                />
                <button
                  type="submit"
                  disabled={isTyping}
                  className="absolute right-3 p-3 rounded-none bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                  <Zap size={20} fill="currentColor" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar / Stats */}
        <div className="space-y-12">
          {/* Skill Orbit */}
          <div className="bg-foreground/[0.02] rounded-none p-10 space-y-8 relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-none blur-[100px] group-hover:bg-primary/20 transition-all duration-1000" />
            
            <div className="flex items-center gap-3 relative z-10">
              <Zap size={14} className="text-primary" />
              <span className="text-[10px] font-black text-foreground uppercase tracking-[0.4em]">Learned Skills</span>
            </div>

            <div className="grid grid-cols-1 gap-4 relative z-10">
              {skills.length > 0 ? skills.map((skill, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-none bg-foreground/[0.03] hover:bg-foreground/[0.05] transition-all group/skill">
                  <div className="w-8 h-8 rounded-none bg-primary/10 flex items-center justify-center text-primary group-hover/skill:scale-110 transition-transform">
                    <Shield size={14} />
                  </div>
                  <span className="text-xs font-black text-foreground/60 uppercase tracking-widest">{skill.replace('✓ enabled', '').trim()}</span>
                </div>
              )) : (
                <p className="text-[10px] font-black text-foreground/10 uppercase tracking-widest text-center py-12">No skills indexed yet.</p>
              )}
            </div>
          </div>

          {/* System Hardware */}
          <div className="bg-foreground/[0.02] rounded-none p-10 space-y-8 border-none">
            <div className="flex items-center gap-3">
              <Cpu size={14} className="text-primary" />
              <span className="text-[10px] font-black text-foreground uppercase tracking-[0.4em]">Neural Metrics</span>
            </div>

            <div className="space-y-6">
              <MetricBar label="Self-Correction" value={92} color="bg-primary" />
              <MetricBar label="Deep Research" value={78} color="bg-zinc-500" />
              <MetricBar label="Autonomous Flow" value={85} color="bg-zinc-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBar = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
      <span className="text-foreground/40">{label}</span>
      <span className="text-foreground">{value}%</span>
    </div>
    <div className="h-1.5 w-full bg-foreground/[0.03] rounded-none overflow-hidden">
      <div className={`h-full ${color} rounded-none transition-all duration-1000`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

export default Hermes;
