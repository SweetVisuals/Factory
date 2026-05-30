import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { emitToast } from '../utils/events';

const Profile: React.FC = () => {
  const [printifyKey, setPrintifyKey] = useState('');
  const [etsyKey, setEtsyKey] = useState('');
  const [etsyShopId, setEtsyShopId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    const { data } = await supabase.from('api_keys').select('*');
    if (data) {
      data.forEach(item => {
        if (item.service === 'printify') setPrintifyKey(item.key_value);
        if (item.service === 'etsy') setEtsyKey(item.key_value);
        if (item.service === 'etsy_shop_id') setEtsyShopId(item.key_value);
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    const keysToUpsert = [
      { service: 'printify', key_value: printifyKey },
      { service: 'etsy', key_value: etsyKey },
      { service: 'etsy_shop_id', key_value: etsyShopId }
    ];

    const { error } = await supabase
      .from('api_keys')
      .upsert(keysToUpsert, { onConflict: 'service' });

    if (error) {
      emitToast('Error saving keys: ' + error.message, 'error');
    } else {
      emitToast('API Keys securely saved to database!', 'success');
    }
    
    setIsSaving(false);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      padding: '8rem 2rem 2rem 2rem', 
      color: 'var(--text-color)',
      overflowY: 'auto'
    }}>
      <h2 className="page-title" style={{ 
        fontSize: '4rem', 
        marginBottom: '2rem', 
        textAlign: 'center',
        textShadow: 'none'
      }}>API_CONFIGURATIONS</h2>
      
      <div style={{ 
        background: 'var(--card-gradient)',
        backdropFilter: 'blur(32px)',
        padding: '3rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '2.5rem',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        boxShadow: 'inset 4px 4px 0px rgba(255,255,255,0.05), inset -4px -4px 0px rgba(0,0,0,0.5), 0 40px 80px rgba(0,0,0,0.8)',
        borderRadius: '8px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Accent glow line */}
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '2px', 
          background: 'linear-gradient(90deg, transparent, var(--accent-color), transparent)' 
        }} />

        <div style={{ 
          backgroundColor: 'rgba(16, 185, 129, 0.1)', 
          padding: '1.5rem',
          boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.3)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
          <p style={{ 
            color: '#10b981', 
            fontSize: '1.3rem', 
            margin: 0,
            fontFamily: 'VT323, monospace',
            letterSpacing: '1px'
          }}>
            AUTHORIZED_ACCESS: Specialist agents utilize these keys for Etsy synchronization and Printify fulfillment.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <label style={{ 
            fontWeight: 'bold', 
            fontSize: '1.4rem', 
            fontFamily: 'VT323, monospace',
            color: 'var(--accent-color)',
            letterSpacing: '2px'
          }}>PRINTIFY_API_KEY</label>
          <input 
            type="password" 
            value={printifyKey}
            onChange={(e) => setPrintifyKey(e.target.value)}
            style={{ 
              padding: '1.2rem', 
              backgroundColor: 'var(--input-bg)', 
              color: 'var(--text-color)', 
              border: 'none',
              fontFamily: 'VT323, monospace',
              fontSize: '1.4rem',
              boxShadow: 'inset 3px 3px 0 rgba(0,0,0,0.5)',
              outline: 'none'
            }}
            placeholder="ptfy_..."
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <label style={{ 
            fontWeight: 'bold', 
            fontSize: '1.4rem', 
            fontFamily: 'VT323, monospace',
            color: 'var(--accent-color)',
            letterSpacing: '2px'
          }}>ETSY_API_KEY</label>
          <input 
            type="password" 
            value={etsyKey}
            onChange={(e) => setEtsyKey(e.target.value)}
            style={{ 
              padding: '1.2rem', 
              backgroundColor: 'var(--input-bg)', 
              color: 'var(--text-color)', 
              border: 'none',
              fontFamily: 'VT323, monospace',
              fontSize: '1.4rem',
              boxShadow: 'inset 3px 3px 0 rgba(0,0,0,0.5)',
              outline: 'none'
            }}
            placeholder="etsy_..."
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <label style={{ 
            fontWeight: 'bold', 
            fontSize: '1.4rem', 
            fontFamily: 'VT323, monospace',
            color: 'var(--accent-color)',
            letterSpacing: '2px'
          }}>ETSY_SHOP_ID</label>
          <input 
            type="text" 
            value={etsyShopId}
            onChange={(e) => setEtsyShopId(e.target.value)}
            style={{ 
              padding: '1.2rem', 
              backgroundColor: 'var(--input-bg)', 
              color: 'var(--text-color)', 
              border: 'none',
              fontFamily: 'VT323, monospace',
              fontSize: '1.4rem',
              boxShadow: 'inset 3px 3px 0 rgba(0,0,0,0.5)',
              outline: 'none'
            }}
            placeholder="12345678"
          />
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="pixel-btn"
          style={{
            marginTop: '1rem',
            padding: '1.5rem',
            backgroundColor: 'var(--accent-color)',
            color: 'var(--btn-text)',
            fontWeight: 'bold',
            fontSize: '1.8rem',
            cursor: 'pointer',
            opacity: isSaving ? 0.5 : 1,
            boxShadow: '6px 6px 0px var(--btn-shadow)',
            fontFamily: 'VT323, monospace',
            letterSpacing: '4px',
            border: 'none'
          }}
        >
          {isSaving ? 'UPLOADING_CREDENTIALS...' : 'SAVE_CONFIGURATIONS'}
        </button>
      </div>
    </div>

  );
};

export default Profile;
