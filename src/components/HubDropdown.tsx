import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface HubDropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  separator?: boolean;    // se true, renderiza separador antes deste item
  disabled?: boolean;
  onClick?: () => void;
}

interface HubDropdownProps {
  label: string;
  icon?: React.ReactNode;
  items: HubDropdownItem[];
  color?: string;          // cor de destaque em hex ou css, ex: '#5eead4'
  glowColor?: string;      // rgba para sombra glow
}

export const HubDropdown: React.FC<HubDropdownProps> = ({
  label,
  icon,
  items,
  color = '#5eead4',
  glowColor = 'rgba(94,234,212,0.15)',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative pointer-events-auto">
      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          borderColor: open ? color : undefined,
          color: open ? color : undefined,
          boxShadow: open ? `0 0 16px ${glowColor}` : undefined,
        }}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0f192d]/75 backdrop-blur-[20px] border transition-all text-xs font-medium cursor-pointer select-none
          ${open
            ? 'border-current'
            : 'border-[#50b4ff]/25 text-[#7a92b8] hover:text-[#e6f0ff] hover:border-[#3ba9ff]'
          }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-[9999] min-w-[200px] py-1.5 rounded-xl
            bg-[#080e1a]/95 backdrop-blur-[24px] border border-[#50b4ff]/20
            shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(80,180,255,0.08)]
            animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
        >
          {items.map((item) => (
            <React.Fragment key={item.id}>
              {item.separator && (
                <div className="h-px bg-[#50b4ff]/10 mx-3 my-1" />
              )}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick?.();
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors
                  ${item.disabled
                    ? 'text-[#3a4860] cursor-not-allowed'
                    : 'text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#50b4ff]/8 cursor-pointer'
                  }`}
              >
                {item.icon && (
                  <span className="w-4 h-4 flex-shrink-0 opacity-70">{item.icon}</span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[10px] font-mono text-[#3a4860] bg-[#0f192d]/80 px-1.5 py-0.5 rounded-md border border-[#50b4ff]/10">
                    {item.shortcut}
                  </span>
                )}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
