/**
 * Phase2Enrichment.tsx — AI-Enriched Context Review
 * Side-by-side: original brief (left) | structured context (right, editable)
 */

import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { callClaudeJSON } from '@/api/claude';
import type { StructuredBrandContext } from '@/types';
import { PHASE2_SYSTEM_PROMPT } from './prompts';

// Fields to render in the review panel
const FIELD_GROUPS = [
  {
    label: 'Identidad',
    fields: [
      { key: 'brand_context', label: 'Contexto de marca', multiline: true },
      { key: 'brand_story', label: 'Historia de marca', multiline: true },
      { key: 'diferenciador_base', label: 'Diferenciador base', multiline: false },
      { key: 'tono_base', label: 'Tono base', multiline: false },
    ],
  },
  {
    label: 'Audiencia',
    fields: [
      { key: 'icp', label: 'ICP', multiline: true },
      { key: 'key_messages', label: 'Key messages', multiline: true, isArray: true },
      { key: 'differentiators', label: 'Diferenciadores', multiline: true, isArray: true },
      { key: 'competitors', label: 'Competidores', multiline: false, isArray: true },
    ],
  },
  {
    label: 'Canales & Distribución',
    fields: [
      { key: 'canal_base', label: 'Canal base', multiline: false },
      { key: 'canales_activos', label: 'Canales activos', multiline: false, isArray: true },
      { key: 'formatos_activos', label: 'Formatos activos', multiline: false, isArray: true },
      { key: 'geo_principal', label: 'Geo principal', multiline: false },
      { key: 'market', label: 'Mercado', multiline: false },
    ],
  },
  {
    label: 'Copy & Compliance',
    fields: [
      { key: 'cta_base', label: 'CTA base', multiline: false },
      { key: 'disclaimer_base', label: 'Disclaimer', multiline: true },
      { key: 'url_base', label: 'URL base', multiline: false },
      { key: 'applied_compliance_framework', label: 'Compliance framework', multiline: false },
    ],
  },
] as const;

export default function Phase2Enrichment() {
  const { session, dispatch } = useOnboardingStore();
  const ctx = session.structuredContext;
  const [regeneratingField, setRegeneratingField] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [activeRegenField, setActiveRegenField] = useState<string | null>(null);

  if (!ctx) {
    return (
      <div className="flex items-center justify-center h-full text-muted font-mono text-sm">
        No hay contexto generado. Vuelve a la Fase 1.
      </div>
    );
  }

  async function handleRegenField(fieldKey: string) {
    if (!ctx) return;
    setRegeneratingField(fieldKey);
    try {
      const result = await callClaudeJSON<{ [key: string]: unknown }>({
        system: PHASE2_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `BRIEF ORIGINAL:\n${session.freeBrief}\n\nCONTEXTO ACTUAL:\n${JSON.stringify(ctx, null, 2)}\n\nREGENERA solo el campo "${fieldKey}" con esta instrucción adicional: ${regenInstruction || 'mejora la calidad y especificidad'}\n\nResponde SOLO con JSON: {"${fieldKey}": <nuevo_valor>}`,
          },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      });
      if (result[fieldKey] !== undefined) {
        dispatch({
          type: 'UPDATE_STRUCTURED_FIELD',
          field: fieldKey as keyof StructuredBrandContext,
          value: result[fieldKey],
        });
      }
      setActiveRegenField(null);
      setRegenInstruction('');
    } catch (err) {
      console.error('Regen failed:', err);
    } finally {
      setRegeneratingField(null);
    }
  }

  function handleApprove() {
    dispatch({ type: 'APPROVE_PHASE2' });
  }

  const fieldsWithReasoning = ctx.claude_reasoning || {};

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Original Brief ─────────────────────────────────────────── */}
      <div className="w-[40%] border-r border-border flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border bg-surface/50 shrink-0">
          <p className="text-[11px] font-mono text-muted uppercase tracking-widest">
            Brief Original
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <pre className="text-sm text-text/70 leading-relaxed whitespace-pre-wrap font-body">
            {session.freeBrief}
          </pre>
        </div>
      </div>

      {/* ── Right: Structured Context ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface/50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse-accent" />
            <p className="text-[11px] font-mono text-accent uppercase tracking-widest">
              Claude · Contexto Enriquecido
            </p>
            {ctx.detected_industry && (
              <span className="px-2 py-0.5 rounded bg-s2 border border-border text-[10px] font-mono text-muted">
                {ctx.detected_industry}
              </span>
            )}
          </div>

          <button
            onClick={handleApprove}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-bg font-display font-bold text-sm tracking-wide hover:bg-accent/90 transition-all"
          >
            Aprobar → Fase 3
          </button>
        </div>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          {FIELD_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-4 h-px bg-border" />
                {group.label}
                <span className="flex-1 h-px bg-border" />
              </p>

              <div className="flex flex-col gap-3">
                {group.fields.map((f) => {
                  const val = ctx[f.key as keyof StructuredBrandContext];
                  const reasoning = fieldsWithReasoning[f.key];
                  const isRegen = activeRegenField === f.key;
                  const isLoading = regeneratingField === f.key;

                  return (
                    <FieldCard
                      key={f.key}
                      fieldKey={f.key}
                      label={f.label}
                      value={val}
                      multiline={'multiline' in f ? f.multiline : false}
                      isArray={'isArray' in f ? (f.isArray as boolean) : false}
                      reasoning={reasoning}
                      isRegenerating={isLoading}
                      showRegenForm={isRegen}
                      regenInstruction={regenInstruction}
                      onRegenClick={() => {
                        setActiveRegenField(isRegen ? null : f.key);
                        setRegenInstruction('');
                      }}
                      onRegenInstructionChange={setRegenInstruction}
                      onRegenSubmit={() => handleRegenField(f.key)}
                      onChange={(newVal) =>
                        dispatch({
                          type: 'UPDATE_STRUCTURED_FIELD',
                          field: f.key as keyof StructuredBrandContext,
                          value: newVal,
                        })
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Palette + Typography suggestions */}
          {ctx.palette_suggestion && (
            <PaletteSuggestionCard palette={ctx.palette_suggestion} />
          )}
          {ctx.typography_suggestion && (
            <TypographySuggestionCard typo={ctx.typography_suggestion} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Field Card ───────────────────────────────────────────────────────────

function FieldCard({
  fieldKey,
  label,
  value,
  multiline,
  isArray,
  reasoning,
  isRegenerating,
  showRegenForm,
  regenInstruction,
  onRegenClick,
  onRegenInstructionChange,
  onRegenSubmit,
  onChange,
}: {
  fieldKey: string;
  label: string;
  value: unknown;
  multiline: boolean;
  isArray: boolean;
  reasoning?: string;
  isRegenerating: boolean;
  showRegenForm: boolean;
  regenInstruction: string;
  onRegenClick: () => void;
  onRegenInstructionChange: (v: string) => void;
  onRegenSubmit: () => void;
  onChange: (v: unknown) => void;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [editing, setEditing] = useState(false);

  const displayValue = isArray
    ? Array.isArray(value)
      ? (value as string[]).join('\n')
      : ''
    : typeof value === 'string'
    ? value
    : value != null
    ? JSON.stringify(value)
    : '';

  function handleBlur(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
    const newVal = e.target.value;
    onChange(isArray ? newVal.split('\n').filter(Boolean) : newVal);
    setEditing(false);
  }

  return (
    <div className="rounded-lg border border-border bg-surface hover:border-border/80 transition-all group">
      {/* Field header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <p className="text-[11px] font-mono text-muted uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {reasoning && (
            <button
              onClick={() => setShowReasoning((v) => !v)}
              className="text-[10px] font-mono text-muted hover:text-accent transition-colors px-1.5 py-0.5 rounded border border-border"
              title="Ver razonamiento de Claude"
            >
              {showReasoning ? 'ocultar' : '?'}
            </button>
          )}
          <button
            onClick={onRegenClick}
            disabled={isRegenerating}
            className="text-[10px] font-mono text-muted hover:text-warning transition-colors px-1.5 py-0.5 rounded border border-border"
            title="Regenerar este campo"
          >
            {isRegenerating ? '...' : '↺'}
          </button>
        </div>
      </div>

      {/* Reasoning */}
      {showReasoning && reasoning && (
        <div className="px-3 py-2 border-b border-border bg-accent-dim">
          <p className="text-[11px] text-accent/70 font-mono italic">{reasoning}</p>
        </div>
      )}

      {/* Value */}
      <div className="px-3 py-2">
        {editing || multiline ? (
          <textarea
            defaultValue={displayValue}
            onBlur={handleBlur}
            onFocus={() => setEditing(true)}
            rows={multiline ? 4 : 2}
            className="w-full bg-transparent text-sm text-text resize-none outline-none font-body leading-relaxed"
            style={{ caretColor: '#00FFD1' }}
          />
        ) : (
          <input
            defaultValue={displayValue}
            onBlur={handleBlur}
            onFocus={() => setEditing(true)}
            className="w-full bg-transparent text-sm text-text outline-none font-body"
            style={{ caretColor: '#00FFD1' }}
          />
        )}
      </div>

      {/* Regen form */}
      {showRegenForm && (
        <div className="px-3 py-2 border-t border-border bg-s2 flex gap-2">
          <input
            autoFocus
            value={regenInstruction}
            onChange={(e) => onRegenInstructionChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onRegenSubmit()}
            placeholder="Instrucción adicional (Enter para regenerar)..."
            className="flex-1 bg-transparent text-xs text-text outline-none font-mono placeholder-muted/40"
          />
          <button
            onClick={onRegenSubmit}
            disabled={isRegenerating}
            className="text-xs font-mono text-accent hover:text-accent/70 transition-colors"
          >
            {isRegenerating ? '...' : '→'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Palette suggestion ────────────────────────────────────────────────────

function PaletteSuggestionCard({ palette }: { palette: NonNullable<StructuredBrandContext['palette_suggestion']> }) {
  const colors = [
    { label: 'Primary', hex: palette.primary },
    { label: 'Secondary', hex: palette.secondary },
    { label: 'Accent', hex: palette.accent },
    { label: 'Background', hex: palette.background },
    { label: 'Text', hex: palette.text },
  ];
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3">
        Paleta sugerida
      </p>
      <div className="flex gap-2">
        {colors.map((c) => (
          <div key={c.label} className="flex flex-col items-center gap-1">
            <div
              className="w-10 h-10 rounded-lg border border-border"
              style={{ backgroundColor: c.hex }}
              title={c.hex}
            />
            <span className="text-[9px] font-mono text-muted">{c.label}</span>
            <span className="text-[9px] font-mono text-muted/60">{c.hex}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypographySuggestionCard({ typo }: { typo: NonNullable<StructuredBrandContext['typography_suggestion']> }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">
        Tipografía sugerida
      </p>
      <div className="flex gap-4 text-xs font-mono">
        <span className="text-muted">Heading: <span className="text-text">{typo.heading_font}</span></span>
        <span className="text-muted">Body: <span className="text-text">{typo.body_font}</span></span>
      </div>
    </div>
  );
}
