import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  fullScreen?: boolean;
  text?: string;
}

const LoadingSpinner = ({ className, fullScreen = true, text = "Querying database..." }: LoadingSpinnerProps) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-foreground",
      fullScreen ? "fixed inset-0 z-50 h-[100dvh] bg-background" : "w-full h-full min-h-[200px]",
      className
    )}>
      <Loader2 className="w-5 h-5 animate-spin text-primary mb-2" />
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">{text}</div>
    </div>
  );
};

export default LoadingSpinner;
