import React from 'react';
import { Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogoProps {
  iconOnly?: boolean;
}

const Logo: React.FC<LogoProps> = ({ iconOnly = false }) => {
  return (
    <div className="flex items-center space-x-2">
      <Zap size={24} className="text-primary animate-pulse" />
      <span className={cn(
        "text-2xl font-bold text-foreground tracking-tight transition-all duration-300 hidden lg:inline",
        iconOnly && "lg:hidden"
      )}>
        ColdSpark
      </span>
    </div>
  );
};

export default Logo;
