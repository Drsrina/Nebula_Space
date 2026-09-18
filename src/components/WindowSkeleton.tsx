import React from 'react';
import { Loader2 } from 'lucide-react';

export const WindowSkeleton: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#070f1e]/90 p-4 space-y-4 overflow-hidden animate-pulse select-none">
      {/* Skeleton Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#18294a]/60" />
          <div className="w-28 h-4 rounded bg-[#18294a]/70" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-6 rounded-md bg-[#18294a]/40" />
          <div className="w-20 h-6 rounded-md bg-[#3ba9ff]/10 border border-[#3ba9ff]/20" />
        </div>
      </div>

      {/* Skeleton Content Rows */}
      <div className="flex-1 flex flex-col justify-center items-center gap-3">
        <div className="flex items-center gap-2.5 text-[#7a92b8] text-xs font-mono">
          <Loader2 className="w-4 h-4 animate-spin text-[#3ba9ff]" />
          <span>Carregando módulo...</span>
        </div>
        <div className="w-3/4 max-w-sm space-y-2 mt-2">
          <div className="h-2.5 bg-[#18294a]/50 rounded-full w-full" />
          <div className="h-2.5 bg-[#18294a]/30 rounded-full w-5/6 mx-auto" />
          <div className="h-2.5 bg-[#18294a]/20 rounded-full w-2/3 mx-auto" />
        </div>
      </div>
    </div>
  );
};
