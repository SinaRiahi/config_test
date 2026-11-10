import React, { useState } from 'react';
import { Search, CheckCircle2, Ban, Globe2 } from 'lucide-react';
import { SUPPORTED_REGIONS_MAP } from '../utils/parser';

export const RegionMatrixPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRegions = Object.entries(SUPPORTED_REGIONS_MAP).filter(([code, data]) => {
    return (
      data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-4.5 space-y-3.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#263548]">
        <div className="flex items-center gap-2 text-sm font-bold text-[#E8EEF6]">
          <Globe2 className="w-4 h-4 text-[#22D3EE]" />
          <span>Google AI Studio Regional Support Directory (180+ Territories)</span>
        </div>

        <div className="relative w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search country or code..."
            className="w-full bg-[#0C1420] border border-[#263548] focus:border-[#22D3EE] rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-mono text-[#E8EEF6] placeholder-[#64748B] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
        {filteredRegions.map(([code, data]) => (
          <div
            key={code}
            className={`px-3 py-2 rounded-lg border flex items-center justify-between transition-colors ${
              data.supported
                ? 'bg-[#0C1420] border-[#263548] hover:border-[#22D3EE]/30'
                : 'bg-[#FB7185]/10 border-[#FB7185]/30'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">{data.flag}</span>
              <span className="font-medium text-[#E8EEF6] truncate">{data.name}</span>
              <span className="text-[10px] font-mono text-[#64748B]">{code}</span>
            </div>
            {data.supported ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
            ) : (
              <Ban className="w-3.5 h-3.5 text-[#FB7185] shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
