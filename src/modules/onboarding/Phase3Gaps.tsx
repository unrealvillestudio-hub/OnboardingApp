/**
 * Phase3Gaps.tsx — Gap Interview
 * Conversational interface: Claude identifies what data is missing
 * that it can't infer. User answers. Claude updates the data map.
 */

import { useState, useEffect, useRef } from 'react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { callClaude } from '@/api/claude';
import type { GapMessage } from '@/types';

const GAP_SYSTEM_PROMPT = `Eres un consultor experto en marketing de marca. Has analizado el brief de la marca y generado un contexto estructurado inicial.

Ahora tu tarea es identificar GAPS — información que no puedes inferir del brief y que requiere datos reales del cliente:
- Precios específicos y SKUs
- URLs reales de productos o páginas
- Credenciales o IDs de plataformas (TenzorArt, HeyGen, etc.)
- Datos operativos específicos (horarios, ubicaciones exactas, equipo)
- Estadísticas o métricas propias

REGLAS:
- Haz UNA pregunta a la vez. Nunca agrupes múltiples preguntas en un mensaje.
- Sé directo y específico. Explica brevemente por qué necesitas el dato.
- Si el usuario responde "no sé" o "no tenemos", marca el gap como "pendiente" y continúa.
- Después de 5-7 intercambios, genera un resumen JSON de los datos recolectados con el tag [GAP_DATA_JSON].
- Responde siempre en español.`;

export default function Phase3Gaps() {
  const { session, dispatch } = useOnboardingStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.gapMessages]);

  // Start gap interview automatically
  useEffect(() => {
    if (session.gapMessages.length === 0 && !session.isLoading) {
      startInterview();
    }
  }, []);

  async function startInterview() {
    dispatch({ type: 'SET_LOADING', loading: true });
    setIsTyping(true);
    try {
      const ctxSummary = JSON.stringify(session.structuredContext, null, 2);
      const response = await callClaude({
        system: GAP_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Contexto estructurado generado:\n\n${ctxSummary}\n\nIdentifica el primer gap más importante e inicia la entrevista.`,
          },
        ],
        max_tokens: 512,
        temperature: 0.6,
      });

      const msg: GapMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_GAP_MESSAGE', message: msg });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
      setIsTyping(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || session.isLoading) return;

    const userMsg: GapMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_GAP_MESSAGE', message: userMsg });
    setInput('');
    setIsTyping(true);
    dispatch({ type: 'SET_LOADING', loading: true });

    const allMessages = [
      ...session.gapMessages,
      userMsg,
    ].map((m) => ({ role: m.role, content: m.content }));

    // Add context at start
    const contextMessage = {
      role: 'user' as const,
      content: `Contexto estructurado de la marca:\n${JSON.stringify(session.structuredContext, null, 2)}`,
    };

    try {
      const response = await callClaude({
        system: GAP_SYSTEM_PROMPT,
        messages: [contextMessage, ...allMessages],
        max_tokens: 512,
        temperature: 0.6,
      });

      const assistantMsg: GapMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_GAP_MESSAGE', message: assistantMsg });

      // Check for gap data JSON
      const jsonMatch = response.match(/\[GAP_DATA_JSON\]([\s\S]*?)\[\/GAP_DATA_JSON\]/);
      if (jsonMatch) {
        try {
          const gapData = JSON.parse(jsonMatch[1].trim());
          dispatch({ type: 'MERGE_GAP_DATA', data: gapData });
        } catch {
          // Ignore parse errors
        }
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
      setIsTyping(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const gapDataKeys = Object.keys(session.gapData);

  return (
    <div className="flex h-full">
      {/* ── Chat area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {session.gapMessages.length === 0 && session.isLoading && (
            <div className="flex items-center gap-3 text-muted text-sm font-mono">
              <TypingDots />
              <span>Identificando gaps...</span>
            </div>
          )}

          {session.gapMessages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {isTyping && session.gapMessages.length > 0 && (
            <div className="flex items-center gap-2 pl-3">
              <div className="w-7 h-7 rounded-full bg-accent-dim border border-accent/20 flex items-center justify-center">
                <span className="text-accent text-[10px] font-mono">AI</span>
              </div>
              <TypingDots />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border bg-surface/50 px-5 py-3 shrink-0">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Responde aquí... (Enter para enviar, Shift+Enter nueva línea)"
                rows={2}
                className="w-full bg-s2 border border-border rounded-lg px-4 py-3 text-sm text-text resize-none outline-none focus:border-accent/50 transition-colors font-body placeholder-muted/40"
                style={{ caretColor: '#00FFD1' }}
                disabled={session.isLoading}
              />
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={sendMessage}
                disabled={!input.trim() || session.isLoading}
                className={`px-4 py-3 rounded-lg text-sm font-display font-bold transition-all ${
                  input.trim() && !session.isLoading
                    ? 'bg-accent text-bg hover:bg-accent/90'
                    : 'bg-s2 text-muted cursor-not-allowed'
                }`}
              >
                →
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_PHASE', phase: 4 })}
                className="px-3 py-2 rounded-lg text-[11px] font-mono text-muted hover:text-text border border-border hover:border-border/80 transition-all"
                title="Saltar a Fase 4"
              >
                Skip →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Gap data tracker ──────────────────────────────────────────────── */}
      <div className="w-72 border-l border-border flex flex-col shrink-0 bg-surface/30">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest">
            Datos recolectados
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {gapDataKeys.length === 0 ? (
            <p className="text-xs text-muted/50 font-mono italic">
              Los datos de gaps aparecerán aquí conforme la conversación avance.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {gapDataKeys.map((key) => (
                <div key={key} className="rounded-lg border border-border bg-surface p-2">
                  <p className="text-[10px] font-mono text-muted uppercase mb-1">{key}</p>
                  <p className="text-xs text-text font-mono">
                    {typeof session.gapData[key] === 'string'
                      ? (session.gapData[key] as string)
                      : JSON.stringify(session.gapData[key])}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border shrink-0">
          <button
            onClick={() => dispatch({ type: 'SET_PHASE', phase: 4 })}
            className="w-full py-2 rounded-lg bg-accent text-bg font-display font-bold text-sm tracking-wide hover:bg-accent/90 transition-all"
          >
            Escribir a Supabase →
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: GapMessage }) {
  const isAssistant = message.role === 'assistant';
  // Strip GAP_DATA_JSON tag from display
  const displayContent = message.content
    .replace(/\[GAP_DATA_JSON\][\s\S]*?\[\/GAP_DATA_JSON\]/g, '')
    .trim();

  return (
    <div className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'} animate-fade-in`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5 ${
          isAssistant
            ? 'bg-accent-dim border border-accent/20 text-accent'
            : 'bg-s2 border border-border text-muted'
        }`}
      >
        {isAssistant ? 'AI' : 'S'}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isAssistant
            ? 'bg-surface border border-border text-text'
            : 'bg-s2 border border-border text-text/80'
        }`}
      >
        <p className="whitespace-pre-wrap font-body">{displayContent}</p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
