import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedNumberProps {
  value: string | number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, className = '' }) => {
  const [prev, setPrev] = useState(value);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (value !== prev) {
      const numPrev = parseFloat(String(prev).replace(/[^0-9.-]+/g, "")) || 0;
      const numCurr = parseFloat(String(value).replace(/[^0-9.-]+/g, "")) || 0;
      
      if (numCurr > numPrev) {
        setDirection(1); // Moving up
      } else if (numCurr < numPrev) {
        setDirection(-1); // Moving down
      }
      setPrev(value);
    }
  }, [value, prev]);

  return (
    <div className={`relative overflow-hidden inline-flex ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(value)}
          initial={{ y: direction * 20, filter: 'blur(4px)', opacity: 0 }}
          animate={{ y: 0, filter: 'blur(0px)', opacity: 1 }}
          exit={{ y: direction * -20, filter: 'blur(4px)', opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
          }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};
