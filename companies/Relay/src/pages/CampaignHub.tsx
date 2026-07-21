import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlusCircle, AlertCircle, Activity, ChevronDown, ChevronRight, Target, LayoutGrid, List } from 'lucide-react';
import CampaignCard from '../components/CampaignCard';
import EmptyState from '../components/EmptyState';
import { useApp } from '../context/AppContext';
import LoadingSpinner from '../components/auth/LoadingSpinner';
import Layout from '../components/layout/Layout';
import { supabase } from '../lib/supabase';
import CreateCampaignModal from '../components/modals/CreateCampaignModal';

export const CampaignHub = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { campaigns, loading, error, refreshCampaigns } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('create') === 'true') {
      setShowCreateModal(true);
      // Clean up query param
      navigate('/campaigns', { replace: true });
    }
  }, [location, navigate]);

  const filteredCampaigns = campaigns;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-32 space-y-4">
          <LoadingSpinner />
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Syncing Campaigns...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-20 bg-black/20 rounded-2xl border border-red-500/10">
          <div className="bg-red-500/10 p-6 mb-6 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Connection Disrupted</h3>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] text-center mb-8 max-w-[250px]">
            The connection to the campaign database was lost.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-white text-black px-8 py-3 hover:scale-105 active:scale-95 font-black uppercase tracking-widest text-[10px] transition-all rounded-lg"
          >
            Retry Connection
          </button>
        </div>
      );
    }

    if (campaigns.length === 0) {
      return <EmptyState />;
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCampaigns.map((campaign) => {
            return (
              <CampaignCard
                key={campaign.id}
                {...campaign}
                onClick={() => navigate(`/campaign/${campaign.id}`)}
              />
            );
          })}
        </div>
        {filteredCampaigns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-black/10 rounded-2xl border border-white/5">
            <Target className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-[11px] font-black text-white/40 uppercase tracking-widest text-center">
              No Campaigns Found for this Filter
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="w-full flex flex-col h-full bg-background overflow-y-auto animate-in fade-in duration-200">
        {/* Dynamic Header Section */}
        <div className="p-8 pb-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
                <h1 className="text-4xl font-black text-white tracking-tighter">Campaigns</h1>
              </div>
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] ml-5">
                Overview of all outbound sequences
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-3 bg-white text-black px-6 py-3 hover:bg-gray-200 transition-all group rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:-translate-y-1"
            >
              <PlusCircle size={16} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-black uppercase tracking-widest text-[10px]">New Campaign</span>
            </button>
          </div>
        </div>

        {/* Stats Summary - Simplified */}
        <div className="px-8 mt-6">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-white/40 font-bold uppercase tracking-widest text-[9px]">
              Showing <span className="text-white mx-1">{filteredCampaigns.length}</span> Active Campaigns
            </span>
          </div>
        </div>

        {/* Unified Campaign Grid */}
        <div className="p-8 pt-4">
          {renderContent()}
        </div>
      </div>

      {showCreateModal && (
        <CreateCampaignModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={refreshCampaigns}
        />
      )}
    </Layout>
  );
};

export default CampaignHub;
