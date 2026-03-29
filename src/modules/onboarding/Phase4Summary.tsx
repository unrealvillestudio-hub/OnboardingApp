/**
 * Phase4Summary.tsx — Write to Supabase & Result Summary
 */

import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { writeBrandToSupabase } from '@/lib/brandWriter';
import type { TableWriteStatus } from '@/types';

export default function Phase4Summary({ onWriteComplete }: { onWriteComplete?: () => void }) {
  const { session, dispatch } = useOnboardingStore();
  const [writing, setWriting] = useState(false);

  const ctx = session.structuredContext;
  const result = session.writeResult;

  async function handleWrite() {
    if (!ctx || !session.targetBrandId || writing) return;
    setWriting(true);
    dispatch({ type: 'SET_LOADING', loading: true });

    try {
      const writeResult = await writeBrandToSupabase(
        session.targetBrandId,
        ctx,
        session.gapData
      );
      dispatch({ type: 'SET_WRITE_RESULT', result: writeResult });
      if (writeResult.success && onWriteComplete) onWriteComplete();
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
    } finally {
      setWriting(false);
    }
  }

  if (!ctx) {
    return (
      <div className="flex items-center justify-center h-full text-muted font-mono text-sm">
        No hay contexto para escribir. Completa las fases anteriores.
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Summary preview ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-surface/50 shrink-0">
          <p className="text-[11px] font-mono text-muted uppercase tracking-widest">
            Resumen de escritura
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
          {/* Pre-write checklist */}
          {!result && (
            <PreWriteChecklist ctx={ctx} gapData={session.gapData} />
          )}

          {/* Write result */}
          {result && (
            <WriteResultView result={result} />
          )}
        </div>

        {/* Action bar */}
        <div className="border-t border-border bg-surface/50 px-6 py-4 shrink-0">
          {!result ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">
                Escribe todos los datos consolidados a Supabase.
              </p>
              <button
                onClick={handleWrite}
                disabled={writing}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-display font-bold text-sm tracking-wide transition-all ${
                  writing
                    ? 'bg-s2 text-muted cursor-not-allowed'
                    : 'bg-accent text-bg hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20'
                }`}
              >
                {writing ? (
                  <>
                    <Spinner />
                    <span>Escribiendo...</span>
                  </>
                ) : (
                  <>
                    <span>Escribir a Supabase</span>
                    <span>↗</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-sm text-accent font-mono">
                      Escritura completada · {result.timestamp.slice(0, 19).replace('T', ' ')} UTC
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-error" />
                    <span className="text-sm text-error font-mono">
                      Escritura parcial — revisa errores
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => dispatch({ type: 'RESET' })}
                className="px-4 py-2 rounded-lg text-sm font-display font-bold text-muted hover:text-text border border-border hover:border-border/80 transition-all"
              >
                Nueva sesión →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats sidebar ─────────────────────────────────────────────────── */}
      <div className="w-72 border-l border-border flex flex-col shrink-0 bg-surface/30">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest">
            Datos de gaps
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {Object.keys(session.gapData).length === 0 ? (
            <p className="text-xs text-muted/50 font-mono italic">Sin datos de gaps</p>
          ) : (
            <pre className="text-[11px] font-mono text-text/70 whitespace-pre-wrap">
              {JSON.stringify(session.gapData, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pre-write checklist ──────────────────────────────────────────────────

import type { StructuredBrandContext } from '@/types';

function PreWriteChecklist({
  ctx,
  gapData,
}: {
  ctx: StructuredBrandContext;
  gapData: Record<string, unknown>;
}) {
  const tables = [
    {
      name: 'brands',
      fields: ['brand_context', 'icp', 'tono_base', 'key_messages', 'diferenciador_base'],
      ready: true,
    },
    {
      name: 'humanize_profiles',
      fields: [],
      ready: ctx.humanize_profiles?.length > 0,
      count: ctx.humanize_profiles?.length,
    },
    {
      name: 'compliance_rules',
      fields: [],
      ready: ctx.compliance_rules?.length > 0,
      count: ctx.compliance_rules?.length,
    },
    {
      name: 'brand_palette',
      fields: [],
      ready: !!ctx.palette_suggestion,
    },
    {
      name: 'brand_typography',
      fields: [],
      ready: !!ctx.typography_suggestion,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display font-bold text-lg text-text">Listo para escribir</h2>
      <p className="text-sm text-muted">
        Los siguientes datos serán escritos a Supabase vía UPSERT:
      </p>

      {tables.map((t) => (
        <div
          key={t.name}
          className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
            t.ready
              ? 'border-accent/20 bg-accent-dim'
              : 'border-border bg-surface opacity-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                t.ready ? 'bg-accent' : 'bg-border'
              }`}
            >
              {t.ready ? (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="#07070F" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <span className="text-muted text-[10px]">—</span>
              )}
            </div>
            <span className="text-sm font-mono text-text">{t.name}</span>
          </div>
          {'count' in t && t.count !== undefined && (
            <span className="text-xs font-mono text-muted">{t.count} filas</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Write result view ─────────────────────────────────────────────────────

function WriteResultView({ result }: { result: { success: boolean; tablesWritten: TableWriteStatus[]; timestamp: string } }) {
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <h2 className="font-display font-bold text-lg text-text">
        {result.success ? '✓ Escritura exitosa' : '⚠ Escritura con errores'}
      </h2>

      <div className="flex flex-col gap-2">
        {result.tablesWritten.map((t) => (
          <div
            key={t.table}
            className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
              t.status === 'success'
                ? 'border-accent/20 bg-accent-dim'
                : t.status === 'skipped'
                ? 'border-border bg-surface opacity-60'
                : 'border-error/30 bg-error/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <StatusIcon status={t.status} />
              <span className="text-sm font-mono text-text">{t.table}</span>
              {t.reason && (
                <span className="text-[10px] font-mono text-muted">{t.reason}</span>
              )}
            </div>
            <span className="text-xs font-mono text-muted">
              {t.status === 'success'
                ? `${t.rowsUpserted} fila${t.rowsUpserted !== 1 ? 's' : ''}`
                : t.status}
            </span>
          </div>
        ))}
      </div>

      {result.success && (
        <div className="p-4 rounded-xl border border-accent/20 bg-accent-dim">
          <p className="text-sm text-text">
            La marca ha sido onboardeada exitosamente. Los datos están disponibles en Supabase.
          </p>
          <p className="text-xs text-muted font-mono mt-2">
            Próximos pasos: configurar voicelab TenzorArt IDs · completar geomix · verificar compliance rules
          </p>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: TableWriteStatus['status'] }) {
  if (status === 'success') {
    return (
      <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l3 3 5-6" stroke="#07070F" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  if (status === 'skipped') {
    return <div className="w-5 h-5 rounded-full bg-border flex items-center justify-center text-muted text-[10px]">—</div>;
  }
  return <div className="w-5 h-5 rounded-full bg-error/30 flex items-center justify-center text-error text-xs">✕</div>;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path d="M13 7A6 6 0 0 0 7 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
