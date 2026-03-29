/**
 * Phase1Input.tsx — Free Brief
 * Large, inviting textarea. No structure imposed.
 * User writes everything they know and feel about the brand.
 */

import { useState, useRef, useEffect } from 'react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { callClaudeJSON } from '@/api/claude';
import type { StructuredBrandContext } from '@/types';
import { PHASE2_SYSTEM_PROMPT } from './prompts';

const PLACEHOLDER = `Escribe todo lo que sabes y sientes sobre esta marca.

No hay estructura correcta. Puedes incluir:
— La historia del fundador y por qué existe esta marca
— A quién le habla y qué problema resuelve
— Qué la hace diferente (aunque sea difícil de articular)
— Cómo huele, suena, se siente — su textura emocional
— Qué le molesta del mercado o de la competencia
— Los miedos del cliente ideal que esta marca resuelve
— Qué quieres que la gente diga después de experimentarla
— URLs, competidores, referencias visuales
— Frases que amas o detestas

Cuanto más rico el input, mejor el output.`;

const WORD_GOAL = 200;

export default function Phase1Input() {
  const { session, dispatch } = useOnboardingStore();
  const textRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = session.freeBrief.trim()
    ? session.freeBrief.trim().split(/\s+/).length
    : 0;
  const progress = Math.min(wordCount / WORD_GOAL, 1);
  const isReady = wordCount >= 50;

  // Auto-resize textarea
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [session.freeBrief]);

  async function handleAnalyze() {
    if (!isReady || session.isLoading) return;
    dispatch({ type: 'SET_LOADING', loading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const ctx = await callClaudeJSON<StructuredBrandContext>({
        system: PHASE2_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `BRAND BRIEF:\n\n${session.freeBrief}\n\n---\nGenerate the complete structured brand context JSON based on this brief. Respond only with the JSON object.`,
          },
        ],
        max_tokens: 4096,
        temperature: 0.5,
      });

      dispatch({ type: 'SET_STRUCTURED_CONTEXT', ctx });
      dispatch({ type: 'SET_PHASE', phase: 2 });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Claude analysis failed',
      });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header strip */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface/50 shrink-0">
        <div className="flex items-center gap-3">
          <WordCountPill count={wordCount} goal={WORD_GOAL} />
          {wordCount >= WORD_GOAL && (
            <span className="text-[10px] font-mono text-accent animate-pulse-accent">
              ✓ BRIEF COMPLETO
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {session.error && (
            <span className="text-xs text-error font-mono">{session.error}</span>
          )}
          <button
            onClick={handleAnalyze}
            disabled={!isReady || session.isLoading}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-display font-bold tracking-wide transition-all ${
              isReady && !session.isLoading
                ? 'bg-accent text-bg hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20'
                : 'bg-s2 text-muted cursor-not-allowed'
            }`}
          >
            {session.isLoading ? (
              <>
                <Spinner />
                <span>Analizando...</span>
              </>
            ) : (
              <>
                <span>Analizar con Claude</span>
                <span className="text-lg">→</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Writing area */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Progress bar at very top */}
        <div className="absolute top-0 left-0 right-0 h-0.5 z-10">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${progress * 100}%`, opacity: progress > 0 ? 1 : 0 }}
          />
        </div>

        <div className="max-w-3xl mx-auto px-8 py-10">
          <textarea
            ref={textRef}
            value={session.freeBrief}
            onChange={(e) => dispatch({ type: 'SET_BRIEF', brief: e.target.value })}
            placeholder={PLACEHOLDER}
            className="w-full min-h-[60vh] bg-transparent text-text text-base leading-8 resize-none outline-none placeholder-muted/40 font-body"
            style={{ caretColor: '#00FFD1' }}
            autoFocus
          />
        </div>
      </div>

      {/* Tips bar */}
      <div className="px-6 py-3 border-t border-border bg-surface/50 shrink-0">
        <div className="flex items-center gap-6 text-[11px] text-muted font-mono overflow-x-auto">
          <TipItem icon="✦" text="Historia del fundador" />
          <TipItem icon="✦" text="ICP y miedos" />
          <TipItem icon="✦" text="Diferenciador real" />
          <TipItem icon="✦" text="Tono y textura" />
          <TipItem icon="✦" text="URLs y referencias" />
        </div>
      </div>
    </div>
  );
}

function WordCountPill({ count, goal }: { count: number; goal: number }) {
  const pct = Math.min((count / goal) * 100, 100);
  const color = pct >= 100 ? 'text-accent' : pct >= 50 ? 'text-warning' : 'text-muted';
  return (
    <span className={`text-xs font-mono ${color} tabular-nums`}>
      {count} palabras
    </span>
  );
}

function TipItem({ icon, text }: { icon: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      <span className="text-accent/50">{icon}</span>
      {text}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path d="M13 7A6 6 0 0 0 7 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
