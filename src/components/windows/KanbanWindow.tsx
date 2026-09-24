import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  CheckSquare,
  Square,
  Tag,
  AlertCircle,
  Calendar,
  CheckCircle2,
  X,
  Edit2,
  Check,
} from 'lucide-react';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  priority?: Priority;
  checklist: ChecklistItem[];
  dueDate?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  color: string;
}

const DB_KEY = 'nebula-kanban-v2';

const defaultColumns: KanbanColumn[] = [
  {
    id: 'todo',
    title: 'A Fazer (To Do)',
    color: '#3ba9ff',
    cards: [
      {
        id: 'card-1',
        title: 'Configurar automações e scripts',
        description: 'Estruturar pipelines de tarefas no Workspace',
        priority: 'high',
        checklist: [
          { id: 'sub-1', text: 'Criar script de teste', done: true },
          { id: 'sub-2', text: 'Agendar execução no crontab', done: false },
          { id: 'sub-3', text: 'Verificar logs de saída', done: false },
        ],
      },
    ],
  },
  {
    id: 'in-progress',
    title: 'Em Progresso',
    color: '#f59e0b',
    cards: [
      {
        id: 'card-2',
        title: 'Refatoração da interface 3D',
        description: 'Polimento de iluminação e renderização dos planos Z',
        priority: 'medium',
        checklist: [
          { id: 'sub-4', text: 'Ajustar contraste do HUD', done: true },
          { id: 'sub-5', text: 'Testar com 10 janelas abertas', done: true },
        ],
      },
    ],
  },
  {
    id: 'done',
    title: 'Concluído (Done)',
    color: '#22c55e',
    cards: [
      {
        id: 'card-3',
        title: 'Autenticação 2FA / TOTP',
        description: 'Setup com QR Code e persistência no auth-config',
        priority: 'urgent',
        checklist: [{ id: 'sub-6', text: 'Validar 6 dígitos no servidor', done: true }],
      },
    ],
  },
];

function loadBoard(): KanbanColumn[] {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return defaultColumns;
    return JSON.parse(raw);
  } catch {
    return defaultColumns;
  }
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
  const [editingSubtask, setEditingSubtask] = useState<{ cardId: string; subId: string; text: string } | null>(null);

  const persist = (cols: KanbanColumn[]) => {
    setColumns(cols);
    saveBoard(cols);
  };

  const addCard = (colId: string) => {
    const title = newCardTitle[colId]?.trim();
    if (!title) {
      setAddingToCol(null);
      return;
    }
    const card: KanbanCard = {
      id: `card-${Date.now()}`,
      title,
      description: '',
      priority: 'medium',
      checklist: [],
    };
    persist(columns.map((col) => (col.id === colId ? { ...col, cards: [...col.cards, card] } : col)));
    setNewCardTitle((prev) => ({ ...prev, [colId]: '' }));
    setAddingToCol(null);
  };

  const deleteCard = (colId: string, cardId: string) => {
    persist(
      columns.map((col) => (col.id === colId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col))
    );
    if (expandedCard === cardId) setExpandedCard(null);
  };

  const moveCard = (toColId: string) => {
    if (!draggingCard) return;
    const { card, fromColId } = draggingCard;
    if (fromColId === toColId) {
      setDraggingCard(null);
      return;
    }
    persist(
      columns.map((col) => {
        if (col.id === fromColId) return { ...col, cards: col.cards.filter((c) => c.id !== card.id) };
        if (col.id === toColId) return { ...col, cards: [...col.cards, card] };
        return col;
      })
    );
    setDraggingCard(null);
  };

  // Subtarefas: Toggle
  const toggleChecklistItem = (colId: string, cardId: string, itemId: string) => {
    persist(
      columns.map((col) =>
        col.id === colId
          ? {
              ...col,
              cards: col.cards.map((c) =>
                c.id === cardId
                  ? {
                      ...c,
                      checklist: c.checklist.map((item) =>
                        item.id === itemId ? { ...item, done: !item.done } : item
                      ),
                    }
                  : c
              ),
            }
          : col
      )
    );
  };

  // Subtarefas: Adicionar
  const addChecklistItem = (colId: string, cardId: string, text: string) => {
    if (!text.trim()) return;
    persist(
      columns.map((col) =>
        col.id === colId
          ? {
              ...col,
              cards: col.cards.map((c) =>
                c.id === cardId
                  ? {
                      ...c,
                      checklist: [...c.checklist, { id: `sub-${Date.now()}`, text: text.trim(), done: false }],
                    }
                  : c
              ),
            }
          : col
      )
    );
  };

  // Subtarefas: Remover individualmente
  const removeChecklistItem = (colId: string, cardId: string, itemId: string) => {
    persist(
      columns.map((col) =>
        col.id === colId
          ? {
              ...col,
              cards: col.cards.map((c) =>
                c.id === cardId
                  ? {
                      ...c,
                      checklist: c.checklist.filter((item) => item.id !== itemId),
                    }
                  : c
              ),
            }
          : col
      )
    );
  };

  // Subtarefas: Editar texto
  const saveEditedSubtask = (colId: string, cardId: string, itemId: string, newText: string) => {
    if (!newText.trim()) return;
    persist(
      columns.map((col) =>
        col.id === colId
          ? {
              ...col,
              cards: col.cards.map((c) =>
                c.id === cardId
                  ? {
                      ...c,
                      checklist: c.checklist.map((item) =>
                        item.id === itemId ? { ...item, text: newText.trim() } : item
                      ),
                    }
                  : c
              ),
            }
          : col
      )
    );
    setEditingSubtask(null);
  };

  // Atualizar prioridade do card
  const setCardPriority = (colId: string, cardId: string, priority: Priority) => {
    persist(
      columns.map((col) =>
        col.id === colId
          ? {
              ...col,
              cards: col.cards.map((c) => (c.id === cardId ? { ...c, priority } : c)),
            }
          : col
      )
    );
  };

  const getPriorityBadge = (p?: Priority) => {
    switch (p) {
      case 'urgent':
        return <span className="text-[9px] font-mono font-bold text-[#ff5c7a] bg-[#ff5c7a]/15 px-1.5 py-0.2 rounded border border-[#ff5c7a]/30">URGENTE</span>;
      case 'high':
        return <span className="text-[9px] font-mono font-semibold text-[#f59e0b] bg-[#f59e0b]/15 px-1.5 py-0.2 rounded border border-[#f59e0b]/30">ALTA</span>;
      case 'medium':
        return <span className="text-[9px] font-mono text-[#3ba9ff] bg-[#3ba9ff]/15 px-1.5 py-0.2 rounded border border-[#3ba9ff]/30">MÉDIA</span>;
      default:
        return <span className="text-[9px] font-mono text-[#7a92b8] bg-slate-800 px-1.5 py-0.2 rounded">BAIXA</span>;
    }
  };

  const totalCards = columns.reduce((s, col) => s + col.cards.length, 0);

  return (
    <div className="flex flex-col h-full bg-[#050b17] text-[#e6f0ff] font-sans overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2a4a] bg-[#081020]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#e6f0ff] font-bold uppercase tracking-wider">
            Kanban Board & Subtarefas
          </span>
          <span className="text-[10px] font-mono text-[#5eead4] bg-[#5eead4]/15 px-2 py-0.5 rounded-full">
            {totalCards} cards ativos
          </span>
        </div>
      </div>

      {/* Columns Container */}
      <div className="flex flex-1 overflow-x-auto overflow-y-hidden gap-0">
        {columns.map((col) => {
          return (
            <div
              key={col.id}
              className="flex flex-col flex-1 min-w-[260px] max-w-[340px] border-r border-[#1a2a4a] last:border-r-0 bg-[#060c18]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => moveCard(col.id)}
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2 border-b border-[#1a2a4a] bg-[#070e1c]"
                style={{ borderTop: `2px solid ${col.color}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold" style={{ color: col.color }}>
                    {col.title}
                  </span>
                  <span className="text-[10px] font-mono bg-[#1a2a4a] text-[#7a92b8] px-1.5 py-0.2 rounded-full">
                    {col.cards.length}
                  </span>
                </div>
              </div>

              {/* Cards List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {col.cards.map((card) => {
                  const isExpanded = expandedCard === card.id;
                  const totalSubs = card.checklist.length;
                  const checkDone = card.checklist.filter((i) => i.done).length;
                  const percent = totalSubs > 0 ? Math.round((checkDone / totalSubs) * 100) : 0;

                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => setDraggingCard({ card, fromColId: col.id })}
                      onDragEnd={() => setDraggingCard(null)}
                      className="bg-[#0a1628] rounded-xl border border-[#1a2a4a] hover:border-[#3ba9ff]/40 transition-all cursor-grab active:cursor-grabbing p-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
                      style={{ opacity: draggingCard?.card.id === card.id ? 0.4 : 1 }}
                    >
                      {/* Top Card Bar: Priority & Actions */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="w-3 h-3 text-[#2a3a5a] shrink-0" />
                          {getPriorityBadge(card.priority)}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCard(col.id, card.id)}
                          className="p-1 rounded text-[#4a6080] hover:text-[#ff5c7a] hover:bg-white/5 transition-colors cursor-pointer"
                          title="Excluir card"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Card Title */}
                      <div
                        onClick={() => setExpandedCard(isExpanded ? null : card.id)}
                        className="text-xs font-medium text-[#e6f0ff] hover:text-[#5eead4] transition-colors cursor-pointer leading-snug"
                      >
                        {card.title}
                      </div>

                      {/* Subtasks Progress Bar */}
                      {totalSubs > 0 && (
                        <div className="mt-2 pt-1 border-t border-[#1a2a4a]/60">
                          <div className="flex items-center justify-between text-[10px] font-mono text-[#7a92b8] mb-1">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-[#5eead4]" />
                              <span>Subtarefas</span>
                            </span>
                            <span className="font-semibold text-white">
                              {checkDone}/{totalSubs} ({percent}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#060c18] overflow-hidden border border-white/5">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${percent}%`,
                                backgroundColor: percent === 100 ? '#22c55e' : col.color,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Expanded View: Description, Priority Changer & Robust Checklist */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-[#1a2a4a] space-y-2.5">
                          {/* Priority Selector */}
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#7a92b8]">
                            <span>Prioridade:</span>
                            {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((pr) => (
                              <button
                                key={pr}
                                type="button"
                                onClick={() => setCardPriority(col.id, card.id, pr)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer ${
                                  card.priority === pr
                                    ? 'bg-[#3ba9ff] text-[#050810] font-bold'
                                    : 'bg-[#060c18] text-[#7a92b8] hover:text-white'
                                }`}
                              >
                                {pr.toUpperCase()}
                              </button>
                            ))}
                          </div>

                          {/* Description Textarea */}
                          <textarea
                            value={card.description ?? ''}
                            onChange={(e) => {
                              const desc = e.target.value;
                              persist(
                                columns.map((c) =>
                                  c.id === col.id
                                    ? {
                                        ...c,
                                        cards: c.cards.map((cd) => (cd.id === card.id ? { ...cd, description: desc } : cd)),
                                      }
                                    : c
                                )
                              );
                            }}
                            placeholder="Descrição detalhada do card..."
                            rows={2}
                            className="w-full bg-[#060c18] border border-[#1a2a4a] rounded-lg px-2 py-1 text-[11px] text-[#a0b4cc] font-mono focus:outline-none focus:border-[#3ba9ff]/40 resize-none"
                          />

                          {/* Checklist Section */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-[#5eead4] font-semibold block mb-1">
                              Subtarefas ({checkDone}/{totalSubs}):
                            </span>

                            {card.checklist.map((item) => {
                              const isEditingThis =
                                editingSubtask?.cardId === card.id && editingSubtask?.subId === item.id;

                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-1.5 py-1 px-1.5 rounded-lg bg-[#060c18]/90 hover:bg-[#081529] border border-white/5 transition-colors group"
                                >
                                  <div
                                    className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                                    onClick={() => toggleChecklistItem(col.id, card.id, item.id)}
                                  >
                                    {item.done ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-[#22c55e] shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-[#4a6080] shrink-0" />
                                    )}

                                    {isEditingThis ? (
                                      <input
                                        autoFocus
                                        value={editingSubtask.text}
                                        onChange={(e) =>
                                          setEditingSubtask({ ...editingSubtask, text: e.target.value })
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            saveEditedSubtask(col.id, card.id, item.id, editingSubtask.text);
                                          }
                                          if (e.key === 'Escape') setEditingSubtask(null);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-black/60 border border-[#3ba9ff]/40 rounded px-1.5 py-0.5 text-xs text-white font-mono flex-1 focus:outline-none"
                                      />
                                    ) : (
                                      <span
                                        className={`text-xs font-mono truncate ${
                                          item.done ? 'line-through text-[#4a6080]' : 'text-[#c6d7eb]'
                                        }`}
                                      >
                                        {item.text}
                                      </span>
                                    )}
                                  </div>

                                  {/* Subtask Row Actions */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isEditingThis ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          saveEditedSubtask(col.id, card.id, item.id, editingSubtask.text);
                                        }}
                                        className="p-1 rounded text-[#22c55e] hover:bg-white/10"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSubtask({ cardId: card.id, subId: item.id, text: item.text });
                                        }}
                                        className="p-1 rounded text-[#4a6080] hover:text-[#3ba9ff] opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Editar texto"
                                      >
                                        <Edit2 className="w-2.5 h-2.5" />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeChecklistItem(col.id, card.id, item.id);
                                      }}
                                      className="p-1 rounded text-[#4a6080] hover:text-[#ff5c7a] opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Remover subtarefa"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Add New Subtask Form */}
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                                if (input && input.value.trim()) {
                                  addChecklistItem(col.id, card.id, input.value);
                                  input.value = '';
                                }
                              }}
                              className="pt-1"
                            >
                              <input
                                placeholder="+ Adicionar subtarefa e tecle Enter..."
                                className="w-full bg-[#060c18] border border-[#1a2a4a] rounded-lg px-2.5 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#5eead4]/40"
                              />
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Card Button / Input */}
                {addingToCol === col.id ? (
                  <div className="bg-[#0a1628] rounded-xl border border-[#3ba9ff]/30 p-2.5 space-y-2">
                    <input
                      autoFocus
                      value={newCardTitle[col.id] ?? ''}
                      onChange={(e) => setNewCardTitle((prev) => ({ ...prev, [col.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addCard(col.id);
                        if (e.key === 'Escape') setAddingToCol(null);
                      }}
                      placeholder="Título da tarefa..."
                      className="w-full bg-[#060c18] border border-[#1a2a4a] rounded-lg px-2.5 py-1.5 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#5eead4]"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => addCard(col.id)}
                        className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-[#3ba9ff] text-[#050810] hover:bg-[#5eead4] transition-all cursor-pointer"
                      >
                        Adicionar
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingToCol(null)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono text-[#7a92b8] hover:text-white transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingToCol(col.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#0a1628] border border-dashed border-[#1a2a4a] hover:border-[#5eead4]/30 transition-all text-xs font-mono cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Cartão</span>
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
