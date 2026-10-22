import React from 'react';

const HEART =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';

/** The Shake Heart mark: a heart mid-shake with double motion lines. */
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 64, className }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" className={className} aria-hidden="true">
    <g transform="rotate(-14 100 100) translate(46 46) scale(4.5)">
      <path d={HEART} fill="#C2461F" />
    </g>
    <g fill="none" strokeLinecap="round">
      <path d="M32 66 Q18 100 32 134" stroke="#1F5F6B" strokeWidth={11} />
      <path d="M12 80 Q2 100 12 120" stroke="#C2461F" strokeWidth={10} />
      <path d="M168 66 Q182 100 168 134" stroke="#1F5F6B" strokeWidth={11} />
      <path d="M188 80 Q198 100 188 120" stroke="#C2461F" strokeWidth={10} />
    </g>
  </svg>
);

/** Mark plus the "goodness tribe" wordmark. */
const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 56, className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`} role="img" aria-label="Goodness Tribe">
    <LogoMark size={size} />
    <span className="font-black tracking-tight leading-none" style={{ fontSize: size * 0.5 }}>
      goodness <span className="text-sun-accent">tribe</span>
    </span>
  </div>
);

export default Logo;
