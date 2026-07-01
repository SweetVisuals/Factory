import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { emitToast } from '../utils/events';

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdated?: (newBalance: number) => void;
}

const TIER_OPTIONS = [
  { id: 'tier-1', name: 'Starter', price: 10, value: 10, description: 'Perfect for small test runs.' },
  { id: 'tier-2', name: 'Growth', price: 25, value: 30, description: '20% bonus credit included.' },
  { id: 'tier-3', name: 'Scale', price: 50, value: 65, description: '30% bonus credit included.' },
  { id: 'tier-4', name: 'Elite', price: 100, value: 140, description: '40% bonus credit included.' },
];

const TopupModal: React.FC<TopupModalProps> = ({ isOpen, onClose, onBalanceUpdated }) => {
  const [balance, setBalance] = useState<number>(100);
  const [selectedTier, setSelectedTier] = useState<string>('tier-2');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadBalance();
    }
  }, [isOpen]);

  const loadBalance = async () => {
    // Load from supabase user metadata
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.user_metadata && typeof user.user_metadata.credits === 'number') {
      setBalance(user.user_metadata.credits);
      if (onBalanceUpdated) onBalanceUpdated(user.user_metadata.credits);
    } else {
      const local = localStorage.getItem('ptn-factory-credits');
      if (local) {
        const val = parseFloat(local);
        setBalance(val);
        if (onBalanceUpdated) onBalanceUpdated(val);
      } else {
        localStorage.setItem('ptn-factory-credits', '100.00');
        if (onBalanceUpdated) onBalanceUpdated(100);
      }
    }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.substring(0, 16);
    const matches = value.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      setCardNumber(parts.join(' '));
    } else {
      setCardNumber(value);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.substring(0, 4);
    if (value.length >= 2) {
      setExpiry(`${value.substring(0, 2)}/${value.substring(2)}`);
    } else {
      setExpiry(value);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setCvv(value.substring(0, 3));
  };

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !expiry || !cvv) {
      emitToast('Please fill out all payment details.', 'error');
      return;
    }

    const tier = TIER_OPTIONS.find(t => t.id === selectedTier);
    if (!tier) return;

    setIsProcessing(true);
    
    // Simulate payment steps
    const steps = [
      'Contacting gateway...',
      'Securing payment token...',
      'Authorizing charge...',
      'Finalizing transaction...'
    ];

    for (let i = 0; i < steps.length; i++) {
      setStep(steps[i]);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    const addedValue = tier.value;
    const newBalance = balance + addedValue;

    try {
      // Persist in metadata
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({
          data: { ...user.user_metadata, credits: newBalance }
        });
      }
      
      localStorage.setItem('ptn-factory-credits', newBalance.toFixed(2));
      setBalance(newBalance);
      if (onBalanceUpdated) onBalanceUpdated(newBalance);

      emitToast(`Successfully added $${addedValue.toFixed(2)} to your balance!`, 'success');
      
      // Clear form
      setCardNumber('');
      setExpiry('');
      setCvv('');
      onClose();
    } catch (err: any) {
      emitToast('Failed to update balance: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
      setStep('');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      color: '#f8fafc',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '24px',
        padding: '2.5rem',
        maxWidth: '750px',
        width: '90%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        position: 'relative'
      }}>
        {/* Close button */}
        <button 
          onClick={onClose}
          disabled={isProcessing}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.5rem',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>

        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>API & Agent Credits Topup</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginTop: '0.4rem', margin: 0 }}>
            Topup your balance to fund search scraping, email validation, and background execution tasks.
          </p>
        </div>

        {/* Balance panel */}
        <div style={{
          backgroundColor: '#1e293b',
          padding: '1.5rem',
          borderRadius: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>CURRENT BALANCE</span>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
              ${balance.toFixed(2)}
            </div>
          </div>
          <div style={{ fontSize: '2rem' }}>💰</div>
        </div>

        {isProcessing ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 0',
            gap: '1.5rem'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid rgba(59, 130, 246, 0.1)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{step}</div>
          </div>
        ) : (
          <form onSubmit={handleTopup} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Tiers Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>SELECT CREDIT TIER</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '1rem'
              }}>
                {TIER_OPTIONS.map(tier => {
                  const isSelected = selectedTier === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTier(tier.id)}
                      style={{
                        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : '#1e293b',
                        border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                        borderRadius: '16px',
                        padding: '1.2rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>{tier.name}</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.5rem 0' }}>${tier.price}</div>
                      <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>Get ${tier.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>SIMULATED CARD PAYMENT</label>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                padding: '1.5rem',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CARD NUMBER</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="4111 1111 1111 1111"
                    style={{
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '0.8rem',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>EXPIRATION DATE</label>
                    <input
                      type="text"
                      value={expiry}
                      onChange={handleExpiryChange}
                      placeholder="MM/YY"
                      style={{
                        backgroundColor: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '0.8rem',
                        color: '#fff',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CVC / CVV</label>
                    <input
                      type="password"
                      value={cvv}
                      onChange={handleCvvChange}
                      placeholder="•••"
                      style={{
                        backgroundColor: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '0.8rem',
                        color: '#fff',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '1.2rem',
                fontSize: '1.1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Authorize Secure Topup
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default TopupModal;
