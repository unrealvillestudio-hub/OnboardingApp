/**
 * BrandGapView.tsx
 * Shown when selecting an existing brand from the sidebar.
 *
 * Flow:
 *  1. Show completeness dashboard for the brand
 *  2. "¿Qué sabe Claude de esta marca?" → generate narrative summary
 *  3. User validates / flags errors
 *  4. "¿Quieres que Claude genere los datos faltantes?" (with context confirmed)
 *  5. Claude generates → Phase 2 review → UPSERT
 */

import { useState } from 'react';
import type { Brand, BrandCompleteness, StructuredBrandContext } from '@/types';
import { callClaude, callClaudeJSON } from '@/api/claude';
import { useOnboardingStore } from '@/store/onboardingStore';
import { PHASE2_SYSTEM_PROMPT, BRAND_SUMMARY_PROMPT } from './prompts';

const FIELD_LABELS: Record<string, string> = {
  brand_context: 'Contexto de marca',
  brand_story: 'Historia de marca',
  icp: 'ICP (cliente ideal)',
  key_messages: 'Key messages',
  competitors: 'Competidores',
  differentiators: 'Diferenciadores',
  diferenciador_base: 'Diferenciador base',
  tono_base: 'Tono base',
  geo_principal: 'Geo principal',
  canal_base: 'Canal base',
  canales_activos: 'Canales activos',
  cta_base: 'CTA base',
  disclaimer_base: 'Disclaimer',
  url_base: 'URL base',
  humanize_profiles: 'Humanize profiles',
  brand_palette: 'Paleta de color',
  brand_typography: 'Tipografía',
};

type SummaryState = 'idle' | 'loading' | 'done' | 'error';
type GenerateState = 'idle' | 'loading' | 'error';
type ContextValidation = 'pending' | 'approved' | 'rejected';

interface Props {
  brand: Brand;
  completeness: BrandCompleteness | undefined;
  onBack: () => void;
  onGenerateComplete: () => void;
  onSkipToPhase1: () => void;
}

export default function BrandGapView({ brand, completeness, onBack, onGenerateComplete, onSkipToPhase1 }: Props) {
  const { dispatch } = useOnboardingStore();

  const [summaryState, setSummaryState] = useState<SummaryState>('idle');
  const [summaryText, setSummaryText] = useState('');
  const [contextValidation, setContextValidation] = useState<ContextValidation>('pending');

  const [generateState, setGenerateState] = useState<GenerateState>('idle');
  const [generateError, setGenerateError] = useState<string | null>(null);

  const pct = completeness?.percent ?? 0;
  const missing = completeness?.missingFields ?? [];
  const filled = completeness?.filledFields ?? 0;
  const total = completeness?.totalFields ?? 0;
  const barColor = pct >= 80 ? '#00FFD1' : pct >= 40 ? '#FFB800' : '#FF4D6A';

  // ── Build known data string from brand object ───────────────────────────
  function buildKnownDataString(): string {
    return Object.entries(brand)
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as string[]).join(', ') : v}`)
      .join('\n');
  }

  // ── Step 1: Generate brand summary ─────────────────────────────────────
  async function handleGenerateSummary() {
    setSummaryState('loading');
    try {
      const knownData = buildKnownDataString();
      const text = await callClaude({
        system: BRAND_SUMMARY_PROMPT,
        messages: [{
          role: 'user',
          content: `Datos actuales en DB para "${brand.display_name}":\n\n${knownData}\n\nGenera el resumen crítico de validación.`,
        }],
        max_tokens: 512,
        temperature: 0.3,
      });
      setSummaryText(text);
      setSummaryState('done');
    } catch (err) {
      setSummaryState('error');
    }
  }

  // ── Step 2: Generate missing fields with Claude ─────────────────────────
  async function handleGenerate() {
    setGenerateState('loading');
    setGenerateError(null);
    try {
      const knownData = buildKnownDataString();
      const validationNote = contextValidation === 'rejected'
        ? `NOTA IMPORTANTE: El operador ha indicado que hay errores en el contexto actual. Ten especial cuidado al inferir — prioriza la consistencia sobre los datos existentes. Campos faltantes: ${missing.join(', ')}.`
        : `Contexto validado por el operador. Campos faltantes a completar: ${missing.join(', ')}.`;

      const ctx = await callClaudeJSON<StructuredBrandContext>({
        system: PHASE2_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `DATOS EXISTENTES EN BASE DE DATOS para "${brand.display_name}":\n\n${knownData}\n\n---\n${validationNote}\n\nGenera el contexto estructurado completo. Para los campos existentes, úsalos como base. Para los faltantes, infiere a partir del contexto. Responde solo con el JSON.`,
        }],
        max_tokens: 4096,
        temperature: 0.4,
      });

      dispatch({ type: 'SET_STRUCTURED_CONTEXT', ctx });
      onGenerateComplete();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Error al generar con Claude');
      setGenerateState('idle');
    }
  }

  const summaryHasWarning = summaryText.includes('⚠');

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-muted hover:text-text transition-colors text-sm font-mono group">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </button>
          <span className="text-border text-xs">|</span>
          <span className="font-display font-bold text-base text-text">{brand.display_name}</span>
          {brand.market && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-s2 text-muted border border-border">{brand.market}</span>
          )}
        </div>
        <span className="text-[10px] font-mono text-muted">Análisis de gaps · brand_id: {brand.id}</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">

          {/* ── 1. Completeness card ─────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-surface p-6 animate-fade-in">
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-display font-bold text-xl text-text">{brand.display_name}</h2>
              <span className="text-3xl font-display font-bold tabular-nums" style={{ color: barColor }}>
                {pct}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-border overflow-hidden mb-4">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor }} />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-5 text-xs font-mono text-muted mb-4">
              <span><span className="text-text font-bold">{filled}</span> completos</span>
              <span><span style={{ color: '#FF4D6A' }} className="font-bold">{missing.length}</span> faltantes</span>
              <span><span className="text-text font-bold">{total}</span> total</span>
            </div>

            {/* Missing fields */}
            {missing.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Campos faltantes</p>
                <div className="flex flex-wrap gap-1.5">
                  {missing.map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded bg-s2 border border-border text-[11px] font-mono text-muted">
                      {FIELD_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {pct === 100 && (
              <p className="text-sm text-accent font-mono mt-2">✓ Todos los campos completos.</p>
            )}
          </div>

          {/* ── 2. Brand Summary — "¿Qué sabe Claude?" ──────────────────── */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-display font-semibold text-text">¿Qué sabe Claude de esta marca?</p>
                <p className="text-[11px] text-muted mt-0.5">Valida el contexto antes de generar datos faltantes</p>
              </div>
              {summaryState === 'idle' && (
                <button
                  onClick={handleGenerateSummary}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-s2 border border-border text-sm font-mono text-muted hover:text-text hover:border-accent/30 transition-all"
                >
                  <span className="text-accent text-base leading-none">◈</span>
                  Ver resumen
                </button>
              )}
            </div>

            {/* Loading */}
            {summaryState === 'loading' && (
              <div className="px-5 py-6 flex items-center gap-3 text-muted text-sm font-mono">
                <MiniSpinner />
                <span>Analizando datos de la marca...</span>
              </div>
            )}

            {/* Error */}
            {summaryState === 'error' && (
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-xs text-error font-mono">Error al generar resumen</span>
                <button onClick={handleGenerateSummary} className="text-xs text-muted hover:text-text font-mono">Reintentar</button>
              </div>
            )}

            {/* Summary result */}
            {summaryState === 'done' && (
              <div>
                <div className="px-5 py-4">
                  {/* Warning badge if Claude detected issues */}
                  {summaryHasWarning && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
                      <span className="text-warning text-sm">⚠</span>
                      <span className="text-[11px] text-warning/80 font-mono">Claude detectó posibles gaps o inconsistencias</span>
                    </div>
                  )}
                  <p className="text-sm text-text/80 leading-relaxed font-body whitespace-pre-wrap">{summaryText}</p>
                </div>

                {/* Validation buttons — only if not yet validated */}
                {contextValidation === 'pending' && (
                  <div className="px-5 py-4 border-t border-border bg-s2 flex items-center gap-3">
                    <p className="text-xs text-muted font-mono flex-1">¿El contexto es correcto?</p>
                    <button
                      onClick={() => setContextValidation('approved')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-dim border border-accent/20 text-accent text-xs font-mono hover:border-accent/50 transition-all"
                    >
                      ✓ Correcto, continuar
                    </button>
                    <button
                      onClick={() => setContextValidation('rejected')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-s2 border border-error/20 text-error/70 text-xs font-mono hover:border-error/50 hover:text-error transition-all"
                    >
                      ✗ Hay errores
                    </button>
                  </div>
                )}

                {/* Approved state */}
                {contextValidation === 'approved' && (
                  <div className="px-5 py-3 border-t border-border bg-accent-dim flex items-center gap-2">
                    <span className="text-accent text-sm">✓</span>
                    <span className="text-xs text-accent/80 font-mono">Contexto validado — Claude usará estos datos como base</span>
                  </div>
                )}

                {/* Rejected state */}
                {contextValidation === 'rejected' && (
                  <div className="px-5 py-3 border-t border-border bg-error/5 border-error/20 flex items-center gap-2">
                    <span className="text-error text-sm">⚠</span>
                    <span className="text-xs text-error/80 font-mono flex-1">Claude tendrá en cuenta los posibles errores al generar</span>
                    <button onClick={onSkipToPhase1} className="text-xs text-muted hover:text-text font-mono underline">
                      Prefiero escribir un brief nuevo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 3. Generate prompt — visible after validation ─────────────── */}
          {(contextValidation === 'approved' || contextValidation === 'rejected') && missing.length > 0 && (
            <div className="rounded-xl border border-accent/20 bg-accent-dim p-5 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
                  <ChevronIcon />
                </div>
                <div className="flex-1">
                  <p className="font-display font-semibold text-text text-sm mb-1">
                    Claude puede generar los {missing.length} campos faltantes
                  </p>
                  <p className="text-xs text-muted leading-relaxed mb-4">
                    {contextValidation === 'approved'
                      ? `Usando el contexto validado como base, inferiré los datos faltantes. Podrás revisar y editar todo en la vista side-by-side antes de guardar.`
                      : `He tomado nota de las inconsistencias. Seré más cuidadoso al inferir los campos faltantes. Igualmente podrás corregir todo en la revisión.`
                    }
                  </p>

                  {generateState === 'idle' && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleGenerate}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-bg font-display font-bold text-sm tracking-wide hover:bg-accent/90 transition-all hover:shadow-lg hover:shadow-accent/20"
                      >
                        <SparkleIcon />
                        Generar con Claude
                      </button>
                      <button
                        onClick={onSkipToPhase1}
                        className="px-4 py-2.5 rounded-lg border border-border text-muted hover:text-text text-xs font-mono transition-all"
                      >
                        Escribir brief nuevo
                      </button>
                    </div>
                  )}

                  {generateState === 'loading' && (
                    <div className="flex items-center gap-3">
                      <GeneratingAnimation />
                      <div>
                        <p className="text-sm text-text font-medium">Generando contexto completo...</p>
                        <p className="text-xs text-muted font-mono mt-0.5">{missing.length} campos · ~15s</p>
                      </div>
                    </div>
                  )}

                  {generateError && (
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-error font-mono">{generateError}</p>
                      <button onClick={handleGenerate} className="text-xs text-muted hover:text-text font-mono">Reintentar</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── 4. All fields complete ───────────────────────────────────── */}
          {pct === 100 && summaryState !== 'idle' && (contextValidation === 'approved' || contextValidation === 'rejected') && (
            <div className="rounded-xl border border-border bg-surface p-5 animate-fade-in">
              <p className="text-sm text-muted mb-3">La marca está completa. ¿Quieres actualizar o regenerar el contexto?</p>
              <div className="flex gap-3">
                <button onClick={onSkipToPhase1} className="px-4 py-2 rounded-lg border border-border text-muted hover:text-text text-xs font-mono transition-all">
                  Escribir brief actualizado
                </button>
                <button onClick={handleGenerate} className="px-4 py-2 rounded-lg bg-accent-dim border border-accent/20 text-accent text-xs font-mono hover:border-accent/40 transition-all">
                  Regenerar con Claude
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5 3 L11 8 L5 13" stroke="#00FFD1" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.22 3.22l1.41 1.41M9.37 9.37l1.41 1.41M9.37 4.63l1.41-1.41M3.22 10.78l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function MiniSpinner() {
  return (
    <svg className="animate-spin shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path d="M13 7A6 6 0 0 0 7 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GeneratingAnimation() {
  return (
    <div className="relative w-10 h-10 shrink-0">
      <svg className="animate-spin absolute inset-0" width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="17" stroke="rgba(0,255,209,0.15)" strokeWidth="2"/>
        <path d="M20 3A17 17 0 0 1 37 20" stroke="#00FFD1" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-accent-dim border border-accent/30 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-accent"/>
        </div>
      </div>
    </div>
  );
}
