import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { emitToast } from '../utils/events';

interface Agent {
  id: string;
  name: string;
  role: string;
  instructions: string;
  status: string;
  department: string;
}

const Employees: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [promptText, setPromptText] = useState('');
  const [loading, setLoading] = useState(true);
  
  // AI Generation State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('department', { ascending: false }) // Group by department
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching agents:', error);
    } else if (data) {
      setAgents(data);
      if (data.length > 0 && !selectedAgent) {
        setSelectedAgent(data[0]);
        setPromptText(data[0].instructions || '');
      }
    }
    setLoading(false);
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setPromptText(agent.instructions || '');
  };

  const handleSave = async () => {
    if (!selectedAgent) return;

    const { error } = await supabase
      .from('agents')
      .update({ instructions: promptText })
      .eq('id', selectedAgent.id);

    if (error) {
      emitToast('Error saving configuration: ' + error.message, 'error');
    } else {
      emitToast('Configuration saved to database!', 'success');
      // Update local state
      setAgents(agents.map(a => a.id === selectedAgent.id ? { ...a, instructions: promptText } : a));
    }
  };

  const handleGenerateWithDeepseek = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    
    // Find the business plan content to pass as context
    const businessPlanContent = agents.find(a => a.name === 'Business Plan')?.instructions || 'No business plan defined yet.';
    
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-6733c8ac2b83402b8626e5e253824488'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are an expert AI orchestrator building a markdown (.md) instruction file for an Openclaw agent. 
              
              CRITICAL CONTEXT (The Business Overview and Objectives):
              ${businessPlanContent}
              
              The current file content you are editing is:\n\n${promptText}\n\n
              The user will ask you to either modify this file or generate a completely new role. 
              Always align your edits with the Business Overview provided above.
              You MUST output ONLY the raw markdown text for the file. Do not wrap it in \`\`\`markdown ticks. Do not add any conversational filler. Just return the exact text.`
            },
            {
              role: 'user',
              content: aiPrompt
            }
          ]
        })
      });

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        let newContent = data.choices[0].message.content.trim();
        if (newContent.startsWith('```markdown')) {
          newContent = newContent.replace(/^```markdown\n/, '').replace(/\n```$/, '');
        } else if (newContent.startsWith('```')) {
          newContent = newContent.replace(/^```\n/, '').replace(/\n```$/, '');
        }
        setPromptText(newContent);
        setAiPrompt('');
      } else {
        alert('Deepseek API returned an unexpected error or empty response.');
      }
    } catch (err) {
      alert('Failed to connect to Deepseek API. Check console for details.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({
    'HQ': false,
    'RELAY': false,
    'SCHEDULER': false
  });

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
  };

  const renderAgentList = (dept: string) => {
    const deptAgents = agents.filter(a => a.department === dept);
    if (deptAgents.length === 0) return null;

    const isExpanded = expandedDepts[dept];

    return (
      <div key={dept} style={{ marginBottom: '1rem' }}>
        <button 
          onClick={() => toggleDept(dept)}
          style={{ 
            width: '100%',
            textAlign: 'left',
            background: `linear-gradient(90deg, ${dept === 'HQ' ? 'rgba(59, 130, 246, 0.1)' : dept === 'RELAY' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'} 0%, transparent 100%)`,
            border: 'none',
            color: dept === 'HQ' ? '#3b82f6' : dept === 'RELAY' ? '#10b981' : '#ef4444',
            padding: '0.5rem',
            marginBottom: '0.5rem',
            fontSize: '1.5rem',
            textTransform: 'uppercase',
            fontFamily: 'VT323, monospace',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{dept} Dept</span>
          <span>{isExpanded ? '[-]' : '[+]'}</span>
        </button>
        
        {isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
            {deptAgents.map(agent => (
              <button 
                key={agent.id}
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  backgroundColor: selectedAgent?.id === agent.id ? 'var(--accent-color)' : '#000',
                  color: selectedAgent?.id === agent.id ? '#000' : 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'VT323, monospace',
                  fontSize: '1.2rem',
                  textTransform: 'uppercase',
                  transition: 'all-linear 0.1s',
                  boxShadow: selectedAgent?.id === agent.id ? '4px 4px 0px rgba(0,0,0,0.5)' : 'none',
                  transform: selectedAgent?.id === agent.id ? 'translate(-2px, -2px)' : 'none'
                }}
                onClick={() => handleSelectAgent(agent)}
              >
                <div style={{ fontWeight: 'bold' }}>{agent.name}</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>{agent.role}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div style={{ color: 'white', fontSize: '2rem', padding: '2rem' }}>LOADING EMPLOYEES...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8rem 2rem 2rem 2rem', overflowY: 'auto' }}>
      <h2 className="page-title" style={{ fontSize: '4rem', marginBottom: '2rem', color: 'white', textAlign: 'center', textShadow: '2px 2px 0 var(--accent-color)' }}>OPERATIONS_HUB</h2>
      
      <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0, maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {/* Sidebar List */}
        <div style={{ 
          width: '350px', 
          display: 'flex', 
          flexDirection: 'column', 
          overflowY: 'auto', 
          padding: '1.5rem',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(32px)',
          boxShadow: 'inset 4px 4px 0px rgba(255,255,255,0.05), inset -4px -4px 0px rgba(0,0,0,0.5), 0 20px 40px rgba(0,0,0,0.8)',
          borderRadius: '8px',
          scrollbarWidth: 'none'
        }}>
          {['HQ', 'RELAY', 'SCHEDULER'].map(dept => renderAgentList(dept))}
        </div>

        {/* Editor Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* AI Prompt Bar */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.8))',
            backdropFilter: 'blur(32px)',
            padding: '1rem', 
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            boxShadow: 'inset 3px 3px 0 rgba(255,255,255,0.05), 0 10px 20px rgba(0,0,0,0.4)',
            borderRadius: '4px'
          }}>
            <div style={{ padding: '0 1rem', color: 'var(--accent-color)', fontFamily: 'VT323', fontSize: '1.5rem' }}>AI_COMMAND:</div>
            <input 
              type="text" 
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={`E.g. 'Optimize the scheduler for maximum throughput'`}
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.3)',
                color: '#fff',
                padding: '1rem 1.5rem',
                fontSize: '1.3rem',
                fontFamily: 'VT323, monospace',
                border: 'none',
                outline: 'none',
                boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.5)'
              }}
            />
            <button 
              onClick={handleGenerateWithDeepseek}
              disabled={isGenerating}
              className="pixel-btn"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: '#000',
                padding: '0.8rem 2rem',
                fontSize: '1.3rem',
                fontFamily: 'VT323, monospace',
                border: 'none',
                cursor: isGenerating ? 'wait' : 'pointer',
                opacity: isGenerating ? 0.7 : 1,
                boxShadow: '4px 4px 0px #fff'
              }}
            >
              {isGenerating ? 'PROCESSING...' : 'EXECUTE'}
            </button>
          </div>

          {/* Main Editor Panel */}
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            backdropFilter: 'blur(32px)',
            boxShadow: 'inset 4px 4px 0px rgba(255,255,255,0.05), inset -4px -4px 0px rgba(0,0,0,0.5), 0 30px 60px rgba(0,0,0,0.6)',
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative'
          }}>
             {/* Accent line */}
             <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent-color), transparent)' }} />

            <div style={{ 
              padding: '1.5rem 2rem', 
              color: 'var(--accent-color)', 
              fontSize: '1.8rem',
              textTransform: 'uppercase',
              fontFamily: 'VT323, monospace',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{selectedAgent?.name || 'SELECT_EMPLOYEE'} // {selectedAgent?.role || '---'}</span>
              <span style={{ fontSize: '1rem', color: '#64748b' }}>SYSTEM_VERSION_4.0</span>
            </div>
            
            <textarea 
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                color: '#cbd5e1',
                padding: '2rem',
                resize: 'none',
                fontFamily: 'VT323, monospace',
                fontSize: '1.4rem',
                lineHeight: '1.6',
                border: 'none',
                outline: 'none',
                scrollbarWidth: 'thin'
              }}
              placeholder="Awaiting agent instruction string..."
            />
            
            <div style={{ padding: '2rem', background: 'rgba(0,0,0,0.2)' }}>
              <button 
                onClick={handleSave}
                className="pixel-btn"
                style={{
                  width: '100%',
                  padding: '1.5rem',
                  backgroundColor: 'var(--accent-color)',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '2rem',
                  fontFamily: 'VT323, monospace',
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  boxShadow: '6px 6px 0px #fff',
                  letterSpacing: '4px'
                }}
              >
                SYNC_TO_CORE_DATABASE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
};

export default Employees;
