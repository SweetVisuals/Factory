import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { createPortal } from 'react-dom';

interface ChatLogEntry {
  id: string;
  agent_name: string;
  message: string;
  created_at: string;
}

const Work: React.FC = () => {
  const [logs, setLogs] = useState<ChatLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<ChatLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'document' | 'slideshow'>('document');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expandedAgents, setExpandedAgents] = useState<string[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDeleteLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('DELETE THIS DELIVERABLE?')) {
      const { error } = await supabase
        .from('chat_logs')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting log:', error);
      } else {
        setLogs(prev => prev.filter(log => log.id !== id));
        if (selectedLog?.id === id) setSelectedLog(null);
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('CLEAR ENTIRE PORTFOLIO? THIS CANNOT BE UNDONE.')) {
      const idsToDelete = logs.map(l => l.id);
      if (idsToDelete.length === 0) return;

      const { error } = await supabase
        .from('chat_logs')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        console.error('Error clearing portfolio:', error);
      } else {
        setLogs([]);
        setSelectedLog(null);
      }
    }
  };

  // Reset slide and view mode when selecting a new log
  useEffect(() => {
    setCurrentSlide(0);
  }, [selectedLog]);

  const extractThoughtAndMessage = (fullMessage: string) => {
    const thoughtMatch = fullMessage.match(/<thought>([\s\S]*?)<\/thought>/);
    const thought = thoughtMatch ? thoughtMatch[1].trim() : null;
    const message = fullMessage.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
    return { thought, message };
  };

  const getSlides = (text: string) => {
    // Try splitting by standard markdown horizontal rule
    let slides = text.split(/\n---\n/);
    if (slides.length <= 1) {
      // Fallback: Split by H1 or H2 tags
      slides = text.split(/\n(?=#{1,2} )/);
    }
    return slides.filter(s => s.trim().length > 0);
  };

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    if (error) {
      console.error('Error fetching chat logs:', error);
    } else if (data) {
      // Filter out small chat messages to focus on substantial work (reports, concepts, etc)
      const substantialWork = data.filter(log => {
        const { message } = extractThoughtAndMessage(log.message);
        
        // Aggressive filtering to remove status updates, acknowledgements, delegation templates, and conversational filler
        const isConversational = /^(Understood|I've delegated|I have delegated|The Market Researcher|I will acknowledge|I am now awaiting|I have completed|I'll get to work)/i.test(message.trim());
        const isShort = message.length < 300;
        const lacksMarkdown = !/(# |\*\*|- |\|)/.test(message);
        const isDelegationTemplate = /(DELEGATE:|FINAL NUCLEAR DELEGATION|Your sole task is|Use PIXAZO:|Replace `PIXAZO:|Generate the images via PIXAZO|PIXAZO prompt:|compile them into the slideshow)/i.test(message);

        return !isShort && !isConversational && !lacksMarkdown && !isDelegationTemplate;
      });
      
      setLogs(substantialWork);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Automatically expand all agents on load
    if (logs.length > 0 && expandedAgents.length === 0) {
      const agents = Array.from(new Set(logs.map(l => l.agent_name)));
      setExpandedAgents(agents);
    }
  }, [logs]);

  if (loading) {
    return <div style={{ color: 'white', fontSize: '2rem', padding: '2rem' }}>LOADING PORTFOLIO...</div>;
  }

  // Group logs by agent
  const groupedLogs = logs.reduce((acc, log) => {
    if (!acc[log.agent_name]) {
      acc[log.agent_name] = [];
    }
    acc[log.agent_name].push(log);
    return acc;
  }, {} as Record<string, ChatLogEntry[]>);

  const activeMessage = selectedLog ? extractThoughtAndMessage(selectedLog.message).message : '';
  const slides = activeMessage ? getSlides(activeMessage) : [];

  const toggleAgent = (agent: string) => {
    setExpandedAgents(prev => 
      prev.includes(agent) ? prev.filter(a => a !== agent) : [...prev, agent]
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8rem 2rem 2rem 2rem', overflowY: 'auto' }}>
      <h2 className="page-title" style={{ fontSize: '4rem', marginBottom: '1rem', color: 'white', textAlign: 'center', textShadow: '2px 2px 0 var(--accent-color)' }}>AGENCY PORTFOLIO</h2>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginBottom: '3rem' }}>
        <p style={{ color: '#94a3b8', fontSize: '1.5rem', margin: 0, fontFamily: 'VT323, monospace' }}>
          FINALIZED DELIVERABLES, REPORTS, AND GENERATED SLIDESHOWS
        </p>
        {logs.length > 0 && (
          <button 
            onClick={handleClearAll}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              color: '#ef4444',
              border: 'none',
              padding: '0.6rem 1.5rem',
              fontFamily: 'VT323, monospace',
              fontSize: '1.4rem',
              cursor: 'pointer',
              transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: '4px 4px 0px #7f1d1d',
              letterSpacing: '2px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(-4px, -4px)';
              e.currentTarget.style.boxShadow = '8px 8px 0px #ef4444';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.background = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '4px 4px 0px #7f1d1d';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)';
            }}
          >
            [×] CLEAR ALL
          </button>
        )}
      </div>
      
      {Object.keys(groupedLogs).length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '1.5rem', fontStyle: 'italic', textAlign: 'center', marginTop: '5rem' }}>
          No portfolio deliverables generated yet. Check back when employees finish rendering presentations.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          {Object.entries(groupedLogs).map(([agentName, agentLogs]) => {
            const isExpanded = expandedAgents.includes(agentName);
            return (
              <div key={agentName} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button 
                  onClick={() => toggleAgent(agentName)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    backgroundColor: 'transparent',
                    color: 'var(--accent-color)', 
                    border: 'none', 
                    padding: '0.5rem 0', 
                    cursor: 'pointer', 
                    fontFamily: 'VT323, monospace', 
                    fontSize: '2.5rem',
                    textTransform: 'uppercase',
                    textAlign: 'left',
                    background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%)'
                  }}
                >
                  <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '1.5rem' }}>▶</span>
                  <span>{agentName}</span>
                  <span style={{ fontSize: '1.2rem', color: '#64748b', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.8rem', borderRadius: '20px' }}>
                    {agentLogs.length} Deliverables
                  </span>
                </button>
                
                {isExpanded && (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
                    gap: '1.5rem', 
                    paddingTop: '1rem' 
                  }}>
                    {agentLogs.map(log => {
                      const { message } = extractThoughtAndMessage(log.message);
                      
                      // Extract summary if present
                      const summaryMatch = message.match(/^\[SUMMARY:\s*(.*?)\]/i);
                      const summary = summaryMatch ? summaryMatch[1].trim() : null;
                      
                      // Clean message for title/snippet extraction
                      const cleanMessageForTitle = summaryMatch 
                        ? message.substring(summaryMatch[0].length).trim() 
                        : message;

                      // Extract title: find the first line starting with # or use the first non-empty line
                      const lines = cleanMessageForTitle.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                      const headerLine = lines.find(l => l.startsWith('#'));
                      const fallbackLine = lines.find(l => !l.startsWith('<') && !l.startsWith('To:') && !l.startsWith('Subject:'));
                      
                      let title = 'Untitled Deliverable';
                      if (headerLine) {
                        title = headerLine.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim();
                      } else if (summary) {
                        title = summary.replace(/[*_`]/g, '').trim();
                      } else if (fallbackLine) {
                        title = fallbackLine.replace(/[*_`]/g, '').trim();
                        if (title.length > 50) title = title.substring(0, 50) + '...';
                      }
                      
                      const cleanMessage = cleanMessageForTitle.replace(/[#*>`-]/g, '').trim();
                      const snippet = cleanMessage.substring(0, 150).replace(/\n/g, ' ') + (cleanMessage.length > 150 ? '...' : '');
                      const isSlideshow = message.includes('---');

                      return (
                        <div 
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.8)',
                            border: 'none',
                            borderRadius: '0',
                            padding: '1.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.8rem',
                            transition: 'all 0.1s ease',
                            boxShadow: '4px 4px 0px rgba(59, 130, 246, 0.6)',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translate(-2px, -2px)';
                            e.currentTarget.style.boxShadow = '6px 6px 0px var(--accent-color)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = '4px 4px 0px rgba(59, 130, 246, 0.6)';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ 
                                backgroundColor: isSlideshow ? 'rgba(192, 132, 252, 0.2)' : 'rgba(16, 185, 129, 0.2)', 
                                color: isSlideshow ? '#c084fc' : '#10b981',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '0',
                                fontSize: '0.9rem',
                                fontFamily: 'VT323, monospace',
                                textTransform: 'uppercase',
                                boxShadow: isSlideshow ? 'inset 0 0 0 2px #c084fc' : 'inset 0 0 0 2px #10b981' // Use inset shadow instead of border
                              }}>
                                {isSlideshow ? 'SLIDESHOW' : 'REPORT'}
                              </span>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ color: '#64748b', fontSize: '1rem', fontFamily: 'VT323, monospace' }}>
                                {new Date(log.created_at).toLocaleDateString()}
                              </span>
                              <button 
                                onClick={(e) => handleDeleteLog(log.id, e)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#64748b',
                                  fontSize: '1.2rem',
                                  cursor: 'pointer',
                                  padding: '0 0.5rem',
                                  fontFamily: 'VT323, monospace',
                                  transition: 'color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                                title="Delete deliverable"
                              >
                                ✖
                              </button>
                            </div>
                          </div>
                          <div style={{ color: '#f8fafc', fontSize: '1.4rem', fontFamily: 'VT323, monospace', lineHeight: '1.2', fontWeight: 'bold' }}>
                            {title}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '1rem', fontFamily: 'Inter, sans-serif', lineHeight: '1.4', flex: 1 }}>
                            {snippet}
                          </div>
                          <div style={{ color: 'var(--accent-color)', fontSize: '0.9rem', fontFamily: 'VT323, monospace', textAlign: 'right', marginTop: 'auto' }}>
                            CLICK TO OPEN ►
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Screen Deliverable Viewer Modal */}
      {selectedLog && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.95)',
          zIndex: 9999, // Ensure it covers the top-nav which is z-index: 50
          display: 'flex',
          flexDirection: 'column',
          padding: '2rem',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Viewer Toolbar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '2rem',
            paddingBottom: '1rem',
            background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%)'
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
              <span style={{ color: 'var(--accent-color)', fontSize: '2rem', fontFamily: 'VT323, monospace', textTransform: 'uppercase' }}>
                {selectedLog.agent_name}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '1.2rem', fontFamily: 'Inter, sans-serif' }}>
                {new Date(selectedLog.created_at).toLocaleString()}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button className={`toolbar-btn ${viewMode === 'document' ? 'active' : ''}`} onClick={() => setViewMode('document')}>
                DOCUMENT VIEW
              </button>
              <button className={`toolbar-btn ${viewMode === 'slideshow' ? 'active' : ''}`} onClick={() => setViewMode('slideshow')}>
                SLIDESHOW VIEW
              </button>
              <button className="toolbar-btn" onClick={() => window.print()}>
                EXPORT PDF
              </button>
              <button 
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'none', border: 'none', color: '#ef4444', fontSize: '2.5rem', cursor: 'pointer', marginLeft: '1rem', fontFamily: 'VT323, monospace'
                }}
              >
                ✖
              </button>
            </div>
          </div>

          {/* Viewer Content */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
            {viewMode === 'document' ? (
              <div className="markdown-content" style={{ width: '100%', maxWidth: '1000px', backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '4rem', borderRadius: '16px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      const isSvgLanguage = match && match[1] === 'svg';
                      const content = String(children).replace(/\n$/, '');
                      
                      // Also catch cases where the AI didn't use ```svg but just returned SVG code
                      const isSvgContent = content.trim().startsWith('<svg') && content.trim().endsWith('</svg>');
                      
                      if (!inline && (isSvgLanguage || isSvgContent)) {
                        return <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }} dangerouslySetInnerHTML={{ __html: content }} />;
                      }
                      
                      return !inline ? (
                        <pre className={className} {...props} style={{ overflowX: 'auto', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                          <code className={className}>
                            {children}
                          </code>
                        </pre>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >{activeMessage}</ReactMarkdown>
              </div>
            ) : (
              <div className="slideshow-container" style={{ width: '100%', height: '100%' }}>
                <div className="slide-content markdown-content">
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      code({node, inline, className, children, ...props}: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        const isSvgLanguage = match && match[1] === 'svg';
                        const content = String(children).replace(/\n$/, '');
                        
                        const isSvgContent = content.trim().startsWith('<svg') && content.trim().endsWith('</svg>');
                        
                        if (!inline && (isSvgLanguage || isSvgContent)) {
                          return <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }} dangerouslySetInnerHTML={{ __html: content }} />;
                        }
                        
                        return !inline ? (
                          <pre className={className} {...props} style={{ overflowX: 'auto', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                            <code className={className}>
                              {children}
                            </code>
                          </pre>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >{slides[currentSlide] || ''}</ReactMarkdown>
                </div>
                <div className="slide-controls">
                  <button className="slide-btn" disabled={currentSlide === 0} onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}>
                    ◄ PREV
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', fontFamily: 'VT323', fontSize: '2rem', padding: '0 1rem', color: 'white' }}>
                    {currentSlide + 1} / {slides.length}
                  </span>
                  <button className="slide-btn" disabled={currentSlide >= slides.length - 1} onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}>
                    NEXT ►
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default Work;
