/**
 * BrandGapView.tsx
 * Shown when selecting an existing brand from the sidebar.
 *
 * Flow:
 *  1. Show completeness + missing fields for this brand
 *  2. Ask: "¿Quieres que Claude genere los datos faltantes?"
 *  3. If yes → Claude generates StructuredBrandContext using existing DB data
 *  4. User reviews + edits side-by-side (reuses Phase2Enrichment)
 *  5. Approves → UPSERT to Supabase
 */

import { useState } from 'react';
import type { Brand, BrandCompleteness, StructuredBrandContext } from '@/types';
import { callClaudeJSON } from '@/api/claude';
import { useOnboardingStore } from '@/store/onboardingStore';
import { PHASE2_SYSTEM_PROMPT } from './prompts';

// Human-readable labels for DB field names
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

interface Props {
  brand: Brand;
  completeness: BrandCompleteness | undefined;
  onBack: () => void;
  onGenerateComplete: () => void; // triggers Phase 2 review
  onSkipToPhase1: () => void;    // manual brief from scratch
}

export default function BrandGapView({ brand, completeness, onBack, onGenerateComplete, onSkipToPhase1 }: Props) {
  const { dispatch } = useOnboardingStore();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const pct = completeness?.percent ?? 0;
  const missing = completeness?.missingFields ?? [];
  const barColor = pct >= 80 ? '#00FFD1' : pct >= 40 ? '#FFB800' : '#FF4D6A';

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      // Build a summary of everything we already know about this brand from DB
      const knownData = Object.entries(brand)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as string[]).join(', ') : v}`)
        .join('\n');

      const ctx = await callClaudeJSON<StructuredBrandContext>({
        system: PHASE2_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `DATOS EXISTENTES EN BASE DE DATOS para la marca "${brand.display_name}":\n\n${knownData}\n\n---\nCampos faltantes a completar: ${missing.join(', ')}\n\nGenera el contexto estructurado completo. Para los campos que ya tienen datos, úsalos tal cual. Para los campos faltantes, infiere a partir de todo el contexto disponible. Responde solo con el JSON.`,
          },
        ],
        max_tokens: 4096,
        temperature: 0.4,
      });

      dispatch({ type: 'SET_STRUCTURED_CONTEXT', ctx });
      onGenerateComplete(); // navigate to Phase 2 review
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar con Claude');
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-muted hover:text-text transition-colors text-sm font-mono group"
          >
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
        <span className="text-[10px] font-mono text-muted">Análisis de gaps</span>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-8 max-w-3xl mx-auto w-full">

        {/* Completeness card */}
        <div className="rounded-xl border border-border bg-surface p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl text-text">
              Estado de datos — {brand.display_name}
            </h2>
            <span
              className="text-2xl font-display font-bold tabular-nums"
              style={{ color: barColor }}
            >
              {pct}%
            </span>
          </div>

          {/* Big progress bar */}
          <div className="h-2 rounded-full bg-border overflow-hidden mb-6">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 text-sm font-mono text-muted mb-5">
            <span>
              <span className="text-text font-bold">{completeness?.filledFields ?? 0}</span> campos completos
            </span>
            <span>
              <span className="text-error font-bold">{missing.length}</span> faltantes
            </span>
            <span>
              <span className="text-text font-bold">{completeness?.totalFields ?? 0}</span> total
            </span>
          </div>

          {/* Missing fields */}
          {missing.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">
                Campos faltantes
              </p>
              <div className="flex flex-wrap gap-2">
                {missing.map((f) => (
                  <span
                    key={f}
                    className="px-2.5 py-1 rounded-md bg-s2 border border-border text-xs font-mono text-muted"
                  >
                    {FIELD_LABELS[f] ?? f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {pct === 100 && (
            <p className="text-sm text-accent font-mono">✓ Todos los campos están completos.</p>
          )}
        </div>

        {/* ── Claude generate prompt ─────────────────────────────────── */}
        {!confirmed && missing.length > 0 && (
          <div className="rounded-xl border border-accent/20 bg-accent-dim p-6 animate-fade-in">
            <div className="flex items-start gap-4">
              {/* AI avatar */}
              <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" stroke="#00FFD1" strokeWidth="1.2" strokeDasharray="3 2"/>
                  <path d="M6 9l2 2 4-4" stroke="#00FFD1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <div className="flex-1">
                <p className="font-display font-semibold text-text mb-1">Claude puede completar estos datos</p>
                <p className="text-sm text-muted leading-relaxed mb-4">
                  Usando todo lo que ya sé de <strong className="text-text">{brand.display_name}</strong> — su contexto, tono, industria y mercado — puedo inferir y generar los <strong className="text-text">{missing.length} campos</strong> que faltan. Podrás revisar y editar todo antes de guardarlo.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfirmed(true)}
                    className="px-5 py-2.5 rounded-lg bg-accent text-bg font-display font-bold text-sm tracking-wide hover:bg-accent/90 transition-all"
                  >
                    Sí, que Claude los genere →
                  </button>
                  <button
                    onClick={onSkipToPhase1}
                    className="px-4 py-2.5 rounded-lg border border-border text-muted hover:text-text hover:border-border/60 text-sm font-mono transition-all"
                  >
                    Prefiero escribir un brief nuevo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirmed → Generate ──────────────────────────────────── */}
        {confirmed && (
          <div className="rounded-xl border border-border bg-surface p-6 animate-fade-in">
            {!generating && !error && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted">
                  Claude va a generar el contexto completo. El resultado aparecerá en la vista de revisión donde podrás editar campo por campo antes de aprobar.
                </p>
                <button
                  onClick={handleGenerate}
                  className="self-start flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-bg font-display font-bold text-sm tracking-wide hover:bg-accent/90 transition-all hover:shadow-lg hover:shadow-accent/20"
                >
                  <SparkleIcon />
                  Generar con Claude
                </button>
              </div>
            )}

            {generating && (
              <div className="flex flex-col items-center gap-4 py-6">
                <GeneratingAnimation />
                <div className="text-center">
                  <p className="text-sm text-text font-medium">Claude está analizando la marca...</p>
                  <p className="text-xs text-muted mt-1 font-mono">Generando {missing.length} campos · esto tomará ~15s</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-error font-mono">{error}</p>
                <button
                  onClick={handleGenerate}
                  className="self-start px-4 py-2 rounded-lg bg-s2 border border-border text-muted hover:text-text text-sm font-mono transition-all"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Complete: go to brief from scratch ───────────────────────── */}
        {pct === 100 && (
          <div className="rounded-xl border border-border bg-surface p-5 animate-fade-in">
            <p className="text-sm text-muted mb-3">¿Quieres actualizar o regenerar el contexto de esta marca?</p>
            <div className="flex items-center gap-3">
              <button
                onClick={onSkipToPhase1}
                className="px-4 py-2 rounded-lg border border-border text-muted hover:text-text hover:border-border/60 text-sm font-mono transition-all"
              >
                Escribir brief actualizado
              </button>
              <button
                onClick={() => { setConfirmed(true); handleGenerate(); }}
                className="px-4 py-2 rounded-lg bg-accent-dim border border-accent/20 text-accent text-sm font-mono hover:border-accent/40 transition-all"
              >
                Regenerar con Claude
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Icons / Animations ───────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.22 3.22l1.41 1.41M9.37 9.37l1.41 1.41M9.37 4.63l1.41-1.41M3.22 10.78l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function GeneratingAnimation() {
  return (
    <div className="relative w-16 h-16">
      {/* Outer ring */}
      <svg className="animate-spin absolute inset-0" width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="28" stroke="rgba(0,255,209,0.15)" strokeWidth="2"/>
        <path d="M32 4A28 28 0 0 1 60 32" stroke="#00FFD1" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      {/* Inner dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-accent-dim border border-accent/30 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse-accent"/>
        </div>
      </div>
    </div>
  );
}
