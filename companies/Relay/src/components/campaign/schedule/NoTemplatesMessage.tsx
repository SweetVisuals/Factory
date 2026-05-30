import React from 'react';
import { MailSearch } from 'lucide-react';

export const NoTemplatesMessage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-none animate-pulse"></div>
        <div className="relative p-8 bg-white/[0.01] rounded-none border-none">
          <MailSearch className="w-16 h-16 text-primary animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Sequence Signal Lost</h3>
        <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black max-w-[280px] leading-relaxed">
          Initialize email modules in the <span className="text-primary italic">Sequence registry</span> before establishing propagation schedules.
        </p>
      </div>
    </div>
  );
};
