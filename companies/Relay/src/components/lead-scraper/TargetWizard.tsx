import React, { useState, useEffect } from 'react';
import { jobRoles } from '../../data/jobRoles';
import { CustomSelect } from '../ui/CustomSelect';
import { Country } from 'country-state-city';
import { ChevronRight, ChevronLeft, Search, CheckCircle2 } from 'lucide-react';

interface TargetWizardProps {
  onSearch: (formData: any) => void;
}

const TargetWizard: React.FC<TargetWizardProps> = ({ onSearch }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    business: '',
    jobRole: '',
    countryCode: '',
    location: '',
    news: '',
    notesContext: '',
    limit: 100,
    deepResearch: false,
    listName: '', // newly added list naming field
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
      } catch (e) {}
    }
  }, []);

  const updateFormData = (newData: Partial<typeof formData>) => {
    const updated = { ...formData, ...newData };
    setFormData(updated);
    localStorage.setItem('lastLeadSearch', JSON.stringify(updated));
  };

  const countries = Country.getAllCountries().map(country => ({
    value: country.isoCode,
    label: country.name
  }));

  const handleNext = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const handlePrev = () => setStep(prev => Math.max(prev - 1, 1));
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ ...formData });
  };

  return (
    <div className="bg-white/[0.02] p-8 mb-8 shadow-2xl relative overflow-hidden">
      {/* Wizard Header */}
      <div className="flex items-center justify-between mb-8 border-b border-white/[0.05] pb-6">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">Target Builder</h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Step {step} of {totalSteps}
          </p>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div 
              key={i} 
              className={`h-2 w-8 transition-all duration-300 ${step >= i + 1 ? 'bg-primary' : 'bg-white/[0.05]'}`}
            />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Industry & Role */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">Who are we targeting?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">What business/industry?</label>
                <input
                  type="text"
                  value={formData.business}
                  onChange={(e) => updateFormData({ business: e.target.value })}
                  className="w-full h-12 bg-white/[0.03] text-white placeholder:text-muted-foreground/20 px-5 text-sm font-bold focus:bg-white/[0.05] transition-all outline-none"
                  placeholder="e.g. Roofers, Gyms"
                  autoFocus
                />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">Job Role</label>
                <CustomSelect
                  value={formData.jobRole}
                  onChange={(value) => updateFormData({ jobRole: value })}
                  options={jobRoles.map(role => ({ value: role, label: role }))}
                  placeholder="Select Role..."
                  className="h-12 bg-white/[0.03]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">Where are they located?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">Country</label>
                <CustomSelect
                  value={formData.countryCode}
                  onChange={(value) => updateFormData({ countryCode: value, location: '' })}
                  options={countries}
                  placeholder="Select Country..."
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
          </div>
        )}

        {/* Step 3: Filters & List Details */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">Filter Settings & Volume</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">List Name (Optional Grouping)</label>
                <input
                  type="text"
                  value={formData.listName}
                  onChange={(e) => updateFormData({ listName: e.target.value })}
                  className="w-full h-12 bg-white/[0.03] text-white placeholder:text-muted-foreground/20 px-5 text-sm font-bold focus:bg-white/[0.05] transition-all outline-none"
                  placeholder="e.g. London Gym Owners 2026"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">Volume (How many leads?)</label>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  step="10"
                  value={formData.limit}
                  onChange={(e) => updateFormData({ limit: parseInt(e.target.value) || 100 })}
                  className="w-full h-12 bg-white/[0.03] text-white placeholder:text-muted-foreground/20 px-5 text-sm font-bold focus:bg-white/[0.05] transition-all outline-none"
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest ml-1">Special Requirements (AI Brain Context)</label>
                <input
                  type="text"
                  value={formData.notesContext}
                  onChange={(e) => updateFormData({ notesContext: e.target.value })}
                  className="w-full h-12 bg-white/[0.03] text-white placeholder:text-muted-foreground/20 px-5 text-sm font-bold focus:bg-white/[0.05] transition-all outline-none"
                  placeholder="e.g. Only find businesses that have a bad website..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Engines & Review */}
        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">Engines & Execution</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { id: 'google', label: 'Google Maps', icon: '📍' },
                { id: 'linkedin', label: 'LinkedIn', icon: '👔' },
                { id: 'companieshouse', label: 'Gov Reg', icon: '🏛️' },
                { id: 'hermes', label: 'Hermes AI', icon: '🤖' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => updateFormData({ 
                    platforms: { ...formData.platforms, [p.id]: !formData.platforms[p.id as keyof typeof formData.platforms] } 
                  })}
                  className={`flex flex-col items-center justify-center p-4 transition-all duration-300 border border-white/5 ${
                    formData.platforms?.[p.id as keyof typeof formData.platforms] 
                      ? 'bg-primary/20 text-primary border-primary/50' 
                      : 'bg-white/[0.02] text-muted-foreground/60 hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="text-xl mb-2">{p.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">{p.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 bg-white/[0.02] p-4 border border-white/5">
              <label className="flex items-center gap-4 cursor-pointer group flex-1">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={formData.deepResearch}
                    onChange={(e) => updateFormData({ deepResearch: e.target.checked })}
                  />
                  <div className={`block w-12 h-6 transition-all duration-300 ${formData.deepResearch ? 'bg-primary' : 'bg-white/[0.05]'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 transition-all duration-300 ${formData.deepResearch ? 'translate-x-6' : ''}`}></div>
                </div>
                <div>
                  <div className="text-sm font-black text-white uppercase tracking-tight">Super Scan (Deep Research)</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Discovers CEOs, Socials, & Verifies Email Deliverability</div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Navigation Actions */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/[0.05]">
          <button
            type="button"
            onClick={handlePrev}
            disabled={step === 1}
            className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              step === 1 ? 'opacity-0 pointer-events-none' : 'text-white/60 hover:text-white bg-white/[0.02] hover:bg-white/[0.05]'
            }`}
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {step < totalSteps ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-black px-10 py-3 text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              <Search size={16} />
              Launch Extraction
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default TargetWizard;
