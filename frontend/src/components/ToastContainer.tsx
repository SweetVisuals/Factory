import React, { useState, useEffect } from 'react';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = Date.now();
      setToasts(prev => [...prev, { id, ...customEvent.detail }]);
      
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };

    window.addEventListener('toast', handleToast);
    return () => window.removeEventListener('toast', handleToast);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          backgroundColor: '#000',
          border: `3px solid ${t.type === 'error' ? '#ef4444' : t.type === 'success' ? '#10b981' : '#3b82f6'}`,
          color: 'white',
          padding: '1rem 2rem',
          fontFamily: '"VT323", monospace',
          fontSize: '1.5rem',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
