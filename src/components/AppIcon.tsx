import React, { useState } from 'react';

interface AppIconProps {
  className?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({ className = 'w-8 h-8' }) => {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <img
        src="/assets/aistudio/icon_7a55bfa0.png"
        alt="VPN Config Checker Icon"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${className} rounded-lg object-contain select-none shadow-sm`}
      />
    );
  }

  return (
    <div
      className={`${className} rounded-lg bg-[#130f2b] border border-[#34296e] flex items-center justify-center text-teal-400 font-bold text-xs`}
    >
      V✓
    </div>
  );
};
