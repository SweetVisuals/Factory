import React, { useState, useEffect } from 'react';
import { jobRoles } from '../../data/jobRoles';
import { CustomSelect } from '../ui/CustomSelect';
import { Country } from 'country-state-city';

interface LeadScraperFormProps {
  onSearch: (formData: any) => void;
}

const LeadScraperForm: React.FC<LeadScraperFormProps> = ({ onSearch }) => {
  const [formData, setFormData] = useState({
    business: '',
    jobRole: '',
    countryCode: '',
    location: '',
    news: '',
    notesContext: '',
    limit: 100,
    deepResearch: false,
    platforms: {
      google: true,
      linkedin: false,
      general: false,
      companieshouse: false,
      bing: false,
      yell: false,
      hermes: false,
    }
  });

  // Load last search from localStorage
  useEffect(() => {
    const savedSearch = localStorage.getItem('lastLeadSearch');
    if (savedSearch) {
      try {
        const parsed = JSON.parse(savedSearch);
        setFormData(prev => ({
          ...prev,
          ...parsed,
          platforms: {
            ...prev.platforms,
            ...(parsed.platforms || {})
          }
        }));
      } catch (e) {
        console.error('Failed to parse last search:', e);
      }
    }
  }, []);

  // Save search to localStorage when it changes
  const updateFormData = (newData: Partial<typeof formData>) => {
    const updated = { ...formData, ...newData };
    setFormData(updated);
    localStorage.setItem('lastLeadSearch', JSON.stringify(updated));
  };

  const countries = Country.getAllCountries().map(country => ({
    value: country.isoCode,
    label: country.name
  }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch({ ...formData });
      }}
      className="bg-white/[0.02] p-8 mb-8 shadow-2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="space-y-3">
          <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">What business?</label>
          <input
            type="text"
            value={formData.business}
            onChange={(e) => updateFormData({ business: e.target.value })}
            className="w-full h-12 bg-white/[0.03] text-white placeholder:text-muted-foreground/20 px-5 text-sm font-bold focus:bg-white/[0.05] transition-all outline-none"
            placeholder="e.g. Roofers, Gyms"
          />
        </div>
        <div className="space-y-3">
          <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">Who to find?</label>
          <CustomSelect
            value={formData.jobRole}
            onChange={(value) => updateFormData({ jobRole: value })}
            options={jobRoles.map(role => ({ value: role, label: role }))}
            placeholder="Select Role..."
            className="h-12 bg-white/[0.03]"
          />
        </div>
        <div className="space-y-3">
          <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">Where?</label>
          <CustomSelect
            value={formData.countryCode}
            onChange={(value) => updateFormData({ countryCode: value, location: '' })}
            options={countries}
            placeholder="Country..."
            className="h-12 bg-white/[0.03]"
          />
        </div>
        <div className="space-y-3">
          <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">Specific City</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => updateFormData({ location: e.target.value })}
            className="w-full h-12 bg-white/[0.03] text-white placeholder:text-muted-foreground/20 px-5 text-sm font-bold focus:bg-white/[0.05] transition-all outline-none"
            placeholder="e.g. London"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-3">
          <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">Special Requirements (AI Brain)</label>
          <input
            type="text"
            value={formData.notesContext}
            onChange={(e) => updateFormData({ notesContext: e.target.value })}
            className="w-full h-12 bg-white/[0.03] text-white placeholder:text-muted-foreground/20 px-5 text-sm font-bold focus:bg-white/[0.05] transition-all outline-none"
            placeholder="e.g. Only find businesses that have a bad website..."
          />
        </div>
        <div className="space-y-3">
          <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">How many leads?</label>
          <input
            type="number"
            min="10"
            max="5000"
            step="10"
            value={formData.limit}
            onChange={(e) => updateFormData({ limit: parseInt(e.target.value) || 100 })}
            className="w-full h-12 bg-white/[0.03] text-white placeholder:text-muted-foreground/20 px-5 text-sm font-bold focus:bg-white/[0.05] transition-all outline-none"
            placeholder="100"
          />
        </div>
      </div>

      <div className="space-y-4 mb-10">
        <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">Select Search Engines & Agents</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {[
            { id: 'google', label: 'Google Maps', icon: '📍' },
            { id: 'linkedin', label: 'LinkedIn', icon: '👔' },
            { id: 'general', label: 'General Search', icon: '🌐' },
            { id: 'companieshouse', label: 'Companies House', icon: '🇬🇧' },
            { id: 'bing', label: 'Bing Maps', icon: '🗺️' },
            { id: 'yell', label: 'Yell.com', icon: '📞' },
            { id: 'hermes', label: 'Hermes AI Agent', icon: '🤖' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => updateFormData({ 
                platforms: { ...formData.platforms, [p.id]: !formData.platforms[p.id as keyof typeof formData.platforms] } 
              })}
              className={`flex flex-col items-center justify-center p-6 transition-all duration-500 rounded-none ${
                formData.platforms?.[p.id as keyof typeof formData.platforms] 
                  ? 'bg-primary text-primary-foreground scale-[1.02]' 
                  : 'bg-white/[0.03] text-muted-foreground/60 hover:bg-white/[0.05]'
              }`}
            >
              <span className="text-2xl mb-3">{p.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 mt-4 bg-white/[0.01] -mx-8 px-8">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <label className="flex items-center gap-4 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={formData.deepResearch}
                onChange={(e) => updateFormData({ deepResearch: e.target.checked })}
              />
              <div className={`block w-12 h-7 transition-all duration-500 ${formData.deepResearch ? 'bg-primary' : 'bg-white/[0.05]'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-5 h-5 transition-all duration-500 ${formData.deepResearch ? 'translate-x-5' : ''}`}></div>
            </div>
            <div>
              <div className="text-sm font-black text-white uppercase tracking-tight">Super Scan</div>
              <div className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors uppercase tracking-widest">CEO Discovery & Socials</div>
            </div>
          </label>
        </div>
        
        <button
          type="submit"
          className="w-full sm:w-auto bg-primary text-primary-foreground px-12 py-4 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 font-black uppercase tracking-widest shadow-none"
        >
          Start Scraper
        </button>
      </div>
    </form>
  );
};

export default LeadScraperForm;
