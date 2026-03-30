/**
 * ChatPanel.tsx — Claude Chat dentro del Onboarding App
 * Panel lateral derecho persistente. Claude conoce el contexto de la marca activa.
 * Sam puede preguntar qué falta, corregir datos, pedir que Claude complete campos.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { callClaude } from '@/api/claude';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  brandContext: string | null;  // JSON string del contexto de la marca activa
  brandName: string | null;
}

const CHAT_SYSTEM_PROMPT = (brandContext: string | null, brandName: string | null) => `
Eres el asistente de brand management de Unrealville Studio, integrado en el Onboarding App.

Tu función:
1. Conoces el contexto actual de la marca activa en Supabase
2. Ayudas a Sam a identificar qué datos faltan, cuáles están incorrectos, cuáles deben mejorarse
3. Cuando Sam te da información nueva o correcciones, la estructuras claramente
4. Puedes sugerir contenido para campos vacíos basándote en el contexto disponible
5. Respondes en español siempre

${brandName ? `MARCA ACTIVA: ${brandName}` : 'No hay marca seleccionada — pide a Sam que seleccione una marca del sidebar.'}

${brandContext ? `CONTEXTO ACTUAL EN SUPABASE:\n${brandContext}` : 'Sin contexto cargado.'}

TABLAS QUE PUEDES AYUDAR A COMPLETAR:
- brands: brand_context, brand_story, icp, key_messages, competitors, differentiators, tono_base, geo_principal, canales_activos, cta_base, disclaimer_base
- humanize_profiles: tone, vocabulary_include, vocabulary_exclude, sentence_style, personality, anti_patterns (por medium: copy/image/video/voice/web)
- brand_palette: role, hex, name, usage
- brand_typography: role, font_family, weight, usage
- geomix: geo, servicios[], combos[]
- brand_goals: horizon (6m/12m/24m), category, goal, kpi, target, baseline
- brand_personas: segmentos ICP por tipo (b2c/b2b), pain_points, motivations, channels, etc.
- compliance_rules: rule_type, severity, rule_text

COMPORTAMIENTO:
- Sé directo y conciso. Sin preámbulos innecesarios.
- Si Sam te da datos para corregir, confirma qué campo exacto cambiarías y a qué valor.
- Si te piden generar contenido para un campo, genera texto listo para copiar/pegar.
- Marca con [FALTA] los campos que están vacíos y son importantes.
- Marca con [CORRECCIÓN SUGERIDA] cuando detectes inconsistencias.
`.trim();

export default function ChatPanel({ isOpen, onClose, brandContext, brandName }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Welcome message cuando se abre con una marca
  useEffect(() => {
    if (isOpen && brandName && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Cargado el contexto de **${brandName}**.\n\n¿Qué quieres revisar? Puedo decirte qué campos faltan, corregir datos existentes, o generar contenido para los campos vacíos.`,
        ts: Date.now(),
      }]);
    }
  }, [isOpen, brandName]);

  // Scroll al fondo cuando hay nuevos mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input cuando abre
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      ts: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantId = `a_${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      ts: Date.now(),
    }]);

    try {
      abortRef.current = new AbortController();

      // Build conversation history for Claude
      const history = [...messages, userMsg].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await callClaude({
        system: CHAT_SYSTEM_PROMPT(brandContext, brandName),
        messages: history,
        max_tokens: 2048,
        temperature: 0.7,
      });

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: response } : m
      ));
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err?.message ?? 'Error de conexión con Claude'}` }
            : m
        ));
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isLoading, messages, brandContext, brandName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClear = () => {
    setMessages([]);
    if (brandName) {
      setMessages([{
        id: 'welcome_new',
        role: 'assistant',
        content: `Chat reiniciado. Contexto de **${brandName}** cargado. ¿En qué trabajamos?`,
        ts: Date.now(),
      }]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full border-l border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse-accent" />
          <span className="text-[11px] font-mono text-accent uppercase tracking-widest">
            Claude · Asistente
          </span>
          {brandName && (
            <span className="px-2 py-0.5 rounded bg-s2 border border-border text-[10px] font-mono text-muted truncate max-w-[120px]">
              {brandName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="text-[10px] font-mono text-muted hover:text-text transition-colors px-2 py-1 rounded border border-transparent hover:border-border"
            title="Limpiar chat"
          >
            limpiar
          </button>
          <button
            onClick={onClose}
            className="text-muted hover:text-text transition-colors p-1 rounded"
            title="Cerrar chat"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* No brand selected */}
      {!brandName && (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <p className="text-muted text-sm font-mono">Selecciona una marca del sidebar</p>
            <p className="text-muted/50 text-xs mt-1">El chat cargará el contexto de Supabase</p>
          </div>
        </div>
      )}

      {/* Messages */}
      {brandName && (
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 scrollbar-thin">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5 ${
                msg.role === 'user'
                  ? 'bg-border text-muted'
                  : 'bg-accent-dim border border-accent/30 text-accent'
              }`}>
                {msg.role === 'user' ? 'S' : '>'}
              </div>

              {/* Bubble */}
              <div className={`max-w-[85%] rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-s2 text-text'
                  : 'bg-surface border border-border text-text'
              }`}>
                {msg.content === '' && isLoading ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <MarkdownText content={msg.content} />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      {brandName && (
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-end gap-2 bg-s2 rounded-xl border border-border focus-within:border-accent/50 transition-colors px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre la marca, pide correcciones, solicita generar campos..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-text resize-none outline-none font-body leading-relaxed max-h-32 scrollbar-thin placeholder-muted/40"
              style={{
                caretColor: '#00FFD1',
                height: 'auto',
                minHeight: '20px',
              }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="text-accent hover:text-accent/70 disabled:text-muted transition-colors pb-0.5 shrink-0"
              title="Enviar (Enter)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 8L2 2l2.5 6L2 14l12-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-muted/50 font-mono mt-1.5 text-center">
            Enter para enviar · Shift+Enter nueva línea
          </p>
        </div>
      )}
    </div>
  );
}

// Simple markdown renderer para bold y listas
function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j} className="font-semibold text-text">{part}</strong> : part
        );

        // List items
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-accent shrink-0 mt-px">·</span>
              <span>{rendered.slice(1)}</span>
            </div>
          );
        }

        // [FALTA] and [CORRECCIÓN SUGERIDA] badges
        if (line.includes('[FALTA]')) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-error/20 text-error border border-error/30 shrink-0 mt-0.5">FALTA</span>
              <span>{line.replace('[FALTA]', '').trim()}</span>
            </div>
          );
        }
        if (line.includes('[CORRECCIÓN SUGERIDA]') || line.includes('[CORRECCION SUGERIDA]')) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-warning/20 text-warning border border-warning/30 shrink-0 mt-0.5">SUGERENCIA</span>
              <span>{line.replace('[CORRECCIÓN SUGERIDA]', '').replace('[CORRECCION SUGERIDA]', '').trim()}</span>
            </div>
          );
        }

        return line ? <span key={i}>{rendered}</span> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}
