import React, { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical, MoreHorizontal, CheckSquare, Square } from 'lucide-react';

interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  link?: string;
  checklist: { id: string; text: string; done: boolean }[];
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  color: string;
}

const DB_KEY = 'nebula-kanban-v1';

const defaultColumns: KanbanColumn[] = [
  { id: 'todo', title: 'To Do', color: '#3ba9ff', cards: [] },
  { id: 'in-progress', title: 'In Progress', color: '#f59e0b', cards: [] },
  { id: 'done', title: 'Done', color: '#22c55e', cards: [] },
];

function loadBoard(): KanbanColumn[] {
  try { return JSON.parse(localStorage.getItem(DB_KEY) ?? 'null') ?? defaultColumns; } catch { return defaultColumns; }
}
function saveBoard(cols: KanbanColumn[]) {
  localStorage.setItem(DB_KEY, JSON.stringify(cols));
}

export const KanbanWindow: React.FC = () => {
  const [columns, setColumns] = useState<KanbanColumn[]>(loadBoard);
  const [draggingCard, setDraggingCard] = useState<{ card: KanbanCard; fromColId: string } | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState<Record<string, string>>({});
  const [addingToCol, setAddingToCol] = useState<string | null>(null);

  const persist = (cols: KanbanColumn[]) => { setColumns(cols); saveBoard(cols); };

  const addCard = (colId: string) => {
    const title = newCardTitle[colId]?.trim();
    if (!title) { setAddingToCol(null); return; }
    const card: KanbanCard = { id: `card-${Date.now()}`, title, description: '', checklist: [] };
    persist(columns.map((col) => col.id === colId ? { ...col, cards: [...col.cards, card] } : col));
    setNewCardTitle((prev) => ({ ...prev, [colId]: '' }));
    setAddingToCol(null);
  };

  const deleteCard = (colId: string, cardId: string) => {
    persist(columns.map((col) => col.id === colId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col));
    if (expandedCard === cardId) setExpandedCard(null);
  };

  const moveCard = (toColId: string) => {
    if (!draggingCard) return;
    const { card, fromColId } = draggingCard;
    if (fromColId === toColId) { setDraggingCard(null); return; }
    persist(columns.map((col) => {
      if (col.id === fromColId) return { ...col, cards: col.cards.filter((c) => c.id !== card.id) };
      if (col.id === toColId) return { ...col, cards: [...col.cards, card] };
      return col;
    }));
    setDraggingCard(null);
  };

  const toggleChecklistItem = (colId: string, cardId: string, itemId: string) => {
    persist(columns.map((col) =>
      col.id === colId ? {
        ...col,
        cards: col.cards.map((c) =>
          c.id === cardId ? {
            ...c,
            checklist: c.checklist.map((item) =>
              item.id === itemId ? { ...item, done: !item.done } : item
            ),
          } : c
        ),
      } : col
    ));
  };

  const addChecklistItem = (colId: string, cardId: string, text: string) => {
    if (!text.trim()) return;
    persist(columns.map((col) =>
      col.id === colId ? {
        ...col,
        cards: col.cards.map((c) =>
          c.id === cardId ? {
            ...c,
            checklist: [...c.checklist, { id: `ci-${Date.now()}`, text: text.trim(), done: false }],
          } : c
        ),
      } : col
    ));
  };

  const totalCards = columns.reduce((s, col) => s + col.cards.length, 0);

  return (
    <div className="flex flex-col h-full bg-[#060d1c]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2a4a] bg-[#080f1e]">
        <span className="text-xs font-mono text-[#e6f0ff] font-semibold">Kanban Board</span>
        <span className="text-[10px] font-mono text-[#4a6080]">{totalCards} cards</span>
      </div>

      {/* Columns */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {columns.map((col) => {
          const doneCount = col.cards.filter((c) => c.checklist.length > 0 && c.checklist.every((i) => i.done)).length;

          return (
            <div
              key={col.id}
              className="flex flex-col flex-1 min-w-[200px] border-r border-[#1a2a4a] last:border-r-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => moveCard(col.id)}
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2 border-b border-[#1a2a4a]"
                style={{ borderTop: `2px solid ${col.color}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold" style={{ color: col.color }}>{col.title}</span>
                  <span className="text-[9px] font-mono bg-[#1a2a4a] text-[#7a92b8] px-1.5 py-0.5 rounded-full">{col.cards.length}</span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {col.cards.map((card) => {
                  const isExpanded = expandedCard === card.id;
                  const checkDone = card.checklist.filter((i) => i.done).length;

                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => setDraggingCard({ card, fromColId: col.id })}
                      onDragEnd={() => setDraggingCard(null)}
                      className="bg-[#0a1628] rounded-lg border border-[#1a2a4a] hover:border-[#3ba9ff]/30 transition-all cursor-grab active:cursor-grabbing"
                      style={{ opacity: draggingCard?.card.id === card.id ? 0.5 : 1 }}
                    >
                      <div className="flex items-start gap-1.5 px-2 pt-2 pb-1">
                        <GripVertical className="w-3 h-3 text-[#2a3a5a] mt-0.5 shrink-0" />
                        <span
                          className="flex-1 text-xs text-[#e6f0ff] cursor-pointer hover:text-[#3ba9ff] transition-colors leading-tight"
                          onClick={() => setExpandedCard(isExpanded ? null : card.id)}
                        >
                          {card.title}
                        </span>
                        <button
                          onClick={() => deleteCard(col.id, card.id)}
                          className="w-4 h-4 flex items-center justify-center rounded text-[#3a4a6a] hover:text-[#ef4444] transition-colors"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Checklist summary */}
                      {card.checklist.length > 0 && (
                        <div className="px-6 pb-1 flex items-center gap-1">
                          <div className="flex-1 h-1 rounded-full bg-[#1a2a4a] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${(checkDone / card.checklist.length) * 100}%`, background: col.color }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-[#4a6080]">{checkDone}/{card.checklist.length}</span>
                        </div>
                      )}

                      {/* Expanded: description + checklist */}
                      {isExpanded && (
                        <div className="px-2 pb-2 space-y-2 border-t border-[#1a2a4a] mt-1 pt-2">
                          <textarea
                            value={card.description ?? ''}
                            onChange={(e) => {
                              const desc = e.target.value;
                              persist(columns.map((c) => c.id === col.id ? {
                                ...c,
                                cards: c.cards.map((cd) => cd.id === card.id ? { ...cd, description: desc } : cd),
                              } : c));
                            }}
                            placeholder="Descrição..."
                            rows={2}
                            className="w-full bg-[#060d1c] border border-[#1a2a4a] rounded px-2 py-1 text-[10px] text-[#7a92b8] font-mono focus:outline-none resize-none"
                          />

                          {/* Checklist */}
                          <div className="space-y-0.5">
                            {card.checklist.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-1.5 cursor-pointer hover:bg-[#0f1e30] rounded px-1 py-0.5 transition-colors"
                                onClick={() => toggleChecklistItem(col.id, card.id, item.id)}
                              >
                                {item.done
                                  ? <CheckSquare className="w-3 h-3 text-[#22c55e] shrink-0" />
                                  : <Square className="w-3 h-3 text-[#4a6080] shrink-0" />}
                                <span className={`text-[10px] font-mono ${item.done ? 'line-through text-[#3a5a7a]' : 'text-[#a0b4cc]'}`}>
                                  {item.text}
                                </span>
                              </div>
                            ))}
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const inp = e.currentTarget.querySelector('input') as HTMLInputElement;
                                addChecklistItem(col.id, card.id, inp.value);
                                inp.value = '';
                              }}
                            >
                              <input
                                placeholder="+ Nova sub-tarefa"
                                className="w-full bg-transparent border border-[#1a2a4a] rounded px-2 py-0.5 text-[10px] text-[#7a92b8] font-mono focus:outline-none focus:border-[#3ba9ff]/30 mt-1"
                              />
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add card form */}
                {addingToCol === col.id ? (
                  <div className="bg-[#0a1628] rounded-lg border border-[#3ba9ff]/30 p-2 space-y-1">
                    <input
                      autoFocus
                      value={newCardTitle[col.id] ?? ''}
                      onChange={(e) => setNewCardTitle((prev) => ({ ...prev, [col.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') addCard(col.id); if (e.key === 'Escape') setAddingToCol(null); }}
                      placeholder="Título do card..."
                      className="w-full bg-[#060d1c] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => addCard(col.id)} className="px-2 py-0.5 rounded text-xs bg-[#3ba9ff]/15 text-[#3ba9ff] hover:bg-[#3ba9ff]/25 transition-all">Adicionar</button>
                      <button onClick={() => setAddingToCol(null)} className="px-2 py-0.5 rounded text-xs text-[#4a6080] hover:text-[#e6f0ff] transition-all">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingToCol(col.id)}
                    className="w-full flex items-center gap-1 px-2 py-1.5 rounded text-[#4a6080] hover:text-[#e6f0ff] hover:bg-[#0a1628]/50 transition-all text-xs font-mono"
                  >
                    <Plus className="w-3 h-3" /> Adicionar card
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
