import React, { useState, useRef, useEffect } from 'react';

export interface MenuDropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  separator?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface MenuGroup {
  id: string;
  label: string;
  items: MenuDropdownItem[];
}

export interface EditorHeaderProps {
  menus: MenuGroup[];
  children?: React.ReactNode;
  className?: string;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  menus,
  children,
  className = '',
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', handleDocumentClick);
    return () => window.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-between px-2 py-1 bg-[#060b17] border-b border-[#14233d] text-xs select-none relative z-30 ${className}`}
    >
      {/* Left side: Menu groups */}
      <div className="flex items-center gap-1">
        {menus.map((menu) => {
          const isOpen = activeMenu === menu.id;
          return (
            <div key={menu.id} className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(isOpen ? null : menu.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  isOpen
                    ? 'bg-[#162744] text-[#5eead4]'
                    : 'text-[#a3b8d7] hover:bg-[#0f1b33] hover:text-white'
                }`}
              >
                {menu.label}
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full mt-1 min-w-[210px] bg-[#091122]/98 backdrop-blur-xl border border-[#3ba9ff]/30 rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                  {menu.items.map((item, idx) => (
                    <React.Fragment key={item.id || idx}>
                      {item.separator && <div className="w-full h-px bg-white/5 my-0.5" />}
                      <button
                        type="button"
                        disabled={item.disabled}
                        onClick={() => {
                          setActiveMenu(null);
                          if (!item.disabled) item.onClick();
                        }}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-left transition-colors ${
                          item.disabled
                            ? 'opacity-40 cursor-not-allowed text-[#7a92b8]'
                            : item.danger
                            ? 'hover:bg-[#ff3b5c]/20 text-[#cbd5e1] hover:text-[#ff8ba7]'
                            : 'hover:bg-[#162744] text-[#cbd5e1] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {item.icon}
                          <span>{item.label}</span>
                        </span>
                        {item.shortcut && (
                          <span className="text-[10px] text-[#506c94] font-mono ml-3">
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
        })}
      </div>

      {/* Right side / Custom children slot */}
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};
