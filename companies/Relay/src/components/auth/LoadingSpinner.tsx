import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  fullScreen?: boolean;
}

const LoadingSpinner = ({ className, fullScreen = true }: LoadingSpinnerProps) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center bg-background text-foreground",
      fullScreen ? "fixed inset-0 z-50 min-h-screen" : "w-full h-full min-h-[200px]",
      className
    )}>
      {/* Ambient glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center w-16 h-16">
          <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" style={{ animationDuration: '1s' }} />
          <div className="absolute inset-2 rounded-full border-r-2 border-purple-500 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
          <Loader2 className="w-6 h-6 text-primary animate-spin" style={{ animationDuration: '2s' }} />
        </div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
          Authenticating...
        </p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
