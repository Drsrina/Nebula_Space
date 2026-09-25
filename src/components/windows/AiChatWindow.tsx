import React, { useRef, useState, useEffect } from "react";
import { Sparkles, Send, Trash2, Copy, Bot, User, Loader2, Check } from "lucide-react";
import { useEditorStore } from "../../store/useEditorStore";
import { authFetch } from "../../lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
}

const SYSTEM_PROMPT = `Voce e o Nebula AI, um assistente de codigo integrado ao IDE espacial Nebula.
Responda de forma concisa e tecnica. Use markdown para codigo.
Quando o usuario pedir para analisar codigo, o contexto do arquivo ativo sera fornecido.`;

export const AiChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ola! Sou o **Nebula AI**. Posso:\n- Explicar e analisar seu codigo\n- Sugerir refatoracoes\n- Responder duvidas tecnicas\n- Revisar o arquivo ativo no editor\n\nComo posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { activeTabPath, tabs } = useEditorStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getActiveFileContext = () => {
    const tab = tabs.find((t) => t.filePath === activeTabPath);
    if (!tab) return "";
    return `\n\n[Arquivo ativo: ${tab.fileName} (${tab.language})]\n\`\`\`${tab.language}\n${tab.content.slice(0, 4000)}\n\`\`\``;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    const loadingMsg: ChatMessage = { id: `a-${Date.now()}`, role: "assistant", content: "", isLoading: true };

    setMessages((p) => [...p, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    const hasCodeKeyword = /codigo|arquivo|refator|explica|analisa|bug|erro|fix|review/i.test(text);
    const context = hasCodeKeyword ? getActiveFileContext() : "";
    const fullPrompt = text + context;

    try {
      const res = await authFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt, systemPrompt: SYSTEM_PROMPT }),
      });

      let reply = "";
      if (res.ok) {
        const d = await res.json();
        reply = d.response || "Sem resposta do servidor AI.";
      } else {
        reply = "⚠ Servidor AI indisponivel. Configure `GEMINI_API_KEY` no `.env` e inicie com `npm run dev`.";
      }

      setMessages((p) => p.map((m) => (m.id === loadingMsg.id ? { ...m, content: reply, isLoading: false } : m)));
    } catch {
      setMessages((p) =>
        p.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: "⚠ Erro de conexao. O servidor Nebula precisa estar rodando.", isLoading: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.split("\n");
        const lang = lines[0].replace("```", "").trim();
        const code = lines.slice(1, -1).join("\n");
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-[#1b2f52]">
            {lang && <div className="text-[10px] px-3 py-1 bg-[#0a1832] text-[#3ba9ff] font-mono">{lang}</div>}
            <pre className="px-3 py-2 bg-[#060d1c] text-[#c8d9f0] font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">{code}</pre>
          </div>
        );
      }
      // Render inline bold (**text**) and plain text
      const segments = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i} className="whitespace-pre-wrap">
          {segments.map((seg, j) =>
            seg.startsWith("**") && seg.endsWith("**") ? (
              <strong key={j} className="font-semibold text-[#e6f0ff]">{seg.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{seg}</span>
            )
          )}
        </span>
      );
    });
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#040810]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#060d1c] border-b border-[#0f1e38] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#a78bfa]" />
          <span className="text-[11px] font-semibold text-[#a3b8d7]">Nebula AI</span>
          <span className="text-[10px] text-[#a78bfa]/50 bg-[#0f1e38] px-1.5 py-0.5 rounded">Gemini</span>
        </div>
        <button onClick={() => setMessages([{ id: "welcome", role: "assistant", content: "Conversa reiniciada! Como posso ajudar?" }])} title="Limpar conversa" className="p-1 rounded hover:bg-[#0f1e38] text-[#5e779d] hover:text-[#ff6b8a] transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "#1b2c4d transparent" }}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} group`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${msg.role === "user" ? "bg-[#3ba9ff]/20" : "bg-[#a78bfa]/20"}`}>
              {msg.role === "user" ? <User className="w-3.5 h-3.5 text-[#3ba9ff]" /> : <Bot className="w-3.5 h-3.5 text-[#a78bfa]" />}
            </div>
            <div className={`relative max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${msg.role === "user" ? "bg-[#0e1e3a] text-[#d1e0f5] rounded-tr-none" : "bg-[#080f20] text-[#c8d9f0] rounded-tl-none border border-[#0f1e38]"}`}>
              {msg.isLoading ? (
                <div className="flex items-center gap-2 text-[#a78bfa]/60">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-[11px] italic">pensando...</span>
                </div>
              ) : (
                renderContent(msg.content)
              )}
              {/* Copy button for assistant messages */}
              {msg.role === "assistant" && !msg.isLoading && (
                <button
                  onClick={() => copyMessage(msg.id, msg.content)}
                  className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-[#0f1e38] hover:bg-[#1b2f52] text-[#5e779d] hover:text-[#5eead4]"
                  title="Copiar mensagem"
                >
                  {copiedMsgId === msg.id ? <Check className="w-2.5 h-2.5 text-[#5eead4]" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 bg-[#060d1c] border-t border-[#0f1e38] shrink-0">
        <div className="flex items-end gap-2 bg-[#080f20] rounded-xl border border-[#1b2f52] px-3 py-2 focus-within:border-[#a78bfa]/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isLoading}
            placeholder="Pergunte algo... (Shift+Enter para nova linha)"
            rows={2}
            className="flex-1 bg-transparent border-none outline-none resize-none font-mono text-[12px] text-[#e2edff] placeholder-[#2a3d5a] caret-[#a78bfa] leading-relaxed"
            style={{ maxHeight: "120px" }}
          />
          <button onClick={sendMessage} disabled={isLoading || !input.trim()} className={`p-1.5 rounded-lg transition-all ${input.trim() && !isLoading ? "bg-[#a78bfa]/20 hover:bg-[#a78bfa]/30 text-[#a78bfa]" : "text-[#2a3d5a] cursor-not-allowed"}`}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-[#2a3d5a] mt-1.5 text-center">
          Enter para enviar • Shift+Enter nova linha • Mencione "codigo" para incluir arquivo ativo
        </p>
      </div>
    </div>
  );
};
