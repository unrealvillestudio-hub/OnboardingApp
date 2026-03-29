/**
 * App.tsx — UNRLVL Brand Onboarding App
 *
 * Views:
 *   'welcome'   — initial screen
 *   'brand-gap' — existing brand: gap analysis + Claude generate option
 *   'onboarding'— 4-phase flow (new brand or post-generate review)
 */

import { useState, useEffect } from 'react';
import type { Dispatch } from 'react';
import type { Brand, BrandCompleteness, OnboardingPhase } from '@/types';
import {
  fetchAllBrands,
  fetchHumanizeProfileCounts,
  fetchPaletteCounts,
  fetchTypographyCounts,
} from '@/lib/supabaseClient';
import {
  OnboardingStoreContext,
  createOnboardingStore,
  computeCompleteness,
} from '@/store/onboardingStore';
import Phase1Input from '@/modules/onboarding/Phase1Input';
import Phase2Enrichment from '@/modules/onboarding/Phase2Enrichment';
import Phase3Gaps from '@/modules/onboarding/Phase3Gaps';
import Phase4Summary from '@/modules/onboarding/Phase4Summary';
import BrandGapView from '@/modules/onboarding/BrandGapView';

// ─── Types ────────────────────────────────────────────────────────────────

type ActiveView = 'welcome' | 'brand-gap' | 'onboarding';

type AppAction =
  | { type: 'START_NEW'; brandId: string }
  | { type: 'EDIT_EXISTING'; brandId: string }
  | { type: 'SET_BRIEF'; brief: string }
  | { type: 'SET_PHASE'; phase: OnboardingPhase }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_STRUCTURED_CONTEXT'; ctx: import('@/types').StructuredBrandContext }
  | { type: 'UPDATE_STRUCTURED_FIELD'; field: keyof import('@/types').StructuredBrandContext; value: unknown }
  | { type: 'APPROVE_PHASE2' }
  | { type: 'ADD_GAP_MESSAGE'; message: import('@/types').GapMessage }
  | { type: 'MERGE_GAP_DATA'; data: Record<string, unknown> }
  | { type: 'SET_WRITE_RESULT'; result: import('@/types').WriteResult }
  | { type: 'RESET' };

const PHASES = [
  { num: 1, label: 'Brief', desc: 'Free narrative' },
  { num: 2, label: 'Enrich', desc: 'AI structuring' },
  { num: 3, label: 'Gaps', desc: 'Fill missing' },
  { num: 4, label: 'Write', desc: 'Save to DB' },
] as const;

// ─── App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [session, dispatch] = createOnboardingStore();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [completeness, setCompleteness] = useState<Record<string, BrandCompleteness>>({});
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('welcome');

  async function loadBrands() {
    setSidebarLoading(true);
    setSidebarError(null);
    try {
      const [allBrands, humanizeCounts, paletteCounts, typoCounts] = await Promise.all([
        fetchAllBrands(),
        fetchHumanizeProfileCounts(),
        fetchPaletteCounts(),
        fetchTypographyCounts(),
      ]);
      setBrands(allBrands);
      const comp: Record<string, BrandCompleteness> = {};
      for (const b of allBrands) {
        comp[b.id] = computeCompleteness(b, {
          humanize: humanizeCounts[b.id] || 0,
          palette: paletteCounts[b.id] || 0,
          typography: typoCounts[b.id] || 0,
        });
      }
      setCompleteness(comp);
    } catch (err) {
      setSidebarError(err instanceof Error ? err.message : 'Failed to load brands');
    } finally {
      setSidebarLoading(false);
    }
  }

  useEffect(() => { loadBrands(); }, []);

  function handleSelectBrand(brandId: string) {
    dispatch({ type: 'EDIT_EXISTING', brandId });
    setActiveView('brand-gap');
  }

  function handleNewBrand() {
    dispatch({ type: 'START_NEW', brandId: `new_${Date.now()}` });
    dispatch({ type: 'SET_PHASE', phase: 1 });
    setActiveView('onboarding');
  }

  function handleBack() {
    dispatch({ type: 'RESET' });
    setActiveView('welcome');
  }

  function handleGapGenerateComplete() {
    dispatch({ type: 'SET_PHASE', phase: 2 });
    setActiveView('onboarding');
  }

  function handleWriteComplete() {
    loadBrands(); // refresh completeness after write
  }

  const selectedBrand = brands.find((b) => b.id === session.targetBrandId);
  const selectedCompleteness = selectedBrand ? completeness[selectedBrand.id] : undefined;

  return (
    <OnboardingStoreContext.Provider value={{ session, dispatch }}>
      <div className="flex h-screen bg-bg text-text font-body overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className={`flex flex-col border-r border-border bg-surface transition-all duration-300 shrink-0 ${sidebarCollapsed ? 'w-16' : 'w-72'}`}>

          {/* Logo */}
          <div className="flex items-center justify-between px-4 py-5 border-b border-border">
            {!sidebarCollapsed ? (
              <button onClick={handleBack} className="flex items-center gap-2.5 hover:opacity-75 transition-opacity" title="Dashboard">
                <div>
                  <p className="font-display font-bold text-sm tracking-widest text-text uppercase leading-tight">
                    UNREAL<span className="text-accent animate-pulse-accent">&gt;</span>ILLE
                  </p>
                  <p className="text-[10px] text-muted font-mono tracking-wider">ONBOARDING</p>
                </div>
              </button>
            ) : (
              <button onClick={handleBack} title="Dashboard" className="flex items-center justify-center w-8 h-8">
                <span className="font-display font-bold text-lg text-accent animate-pulse-accent leading-none">&gt;</span>
              </button>
            )}
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="text-muted hover:text-text transition-colors p-1 rounded ml-auto"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                {sidebarCollapsed
                  ? <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  : <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                }
              </svg>
            </button>
          </div>

          {/* New brand */}
          {!sidebarCollapsed && (
            <div className="px-3 py-3 border-b border-border">
              <button
                onClick={handleNewBrand}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-dim border border-accent/20 hover:border-accent/50 text-accent text-sm font-medium transition-all group"
              >
                <span className="text-lg leading-none group-hover:scale-110 transition-transform">+</span>
                <span>New Brand</span>
              </button>
            </div>
          )}

          {/* Brand list */}
          <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
            {sidebarLoading && (
              <div className="flex flex-col gap-2 px-3 py-4">
                {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-s2 animate-pulse" />)}
              </div>
            )}
            {sidebarError && <div className="px-3 py-4 text-xs text-error font-mono">{sidebarError}</div>}
            {!sidebarLoading && !sidebarError && (
              <div className="flex flex-col gap-1 px-2">
                {brands.map((brand) => (
                  <BrandRow
                    key={brand.id}
                    brand={brand}
                    completeness={completeness[brand.id]}
                    isActive={session.targetBrandId === brand.id}
                    collapsed={sidebarCollapsed}
                    onClick={() => handleSelectBrand(brand.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <div className="px-4 py-3 border-t border-border">
              <p className="text-[10px] text-muted font-mono">{brands.length} brands · Supabase us-east-1</p>
            </div>
          )}
        </aside>

        {/* ── Main ────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeView === 'welcome' && (
            <WelcomeScreen onNewBrand={handleNewBrand} brandCount={brands.length} />
          )}
          {activeView === 'brand-gap' && selectedBrand && (
            <BrandGapView
              brand={selectedBrand}
              completeness={selectedCompleteness}
              onBack={handleBack}
              onGenerateComplete={handleGapGenerateComplete}
              onSkipToPhase1={() => { dispatch({ type: 'SET_PHASE', phase: 1 }); setActiveView('onboarding'); }}
            />
          )}
          {activeView === 'onboarding' && (
            <OnboardingView
              selectedBrand={selectedBrand}
              currentPhase={session.currentPhase}
              dispatch={dispatch as Dispatch<AppAction>}
              onBack={handleBack}
              onWriteComplete={handleWriteComplete}
            />
          )}
        </main>
      </div>
    </OnboardingStoreContext.Provider>
  );
}

// ─── Brand Row ────────────────────────────────────────────────────────────

function BrandRow({ brand, completeness, isActive, collapsed, onClick }: {
  brand: Brand; completeness: BrandCompleteness | undefined;
  isActive: boolean; collapsed: boolean; onClick: () => void;
}) {
  const pct = completeness?.percent ?? 0;
  const barColor = pct >= 80 ? 'bg-accent' : pct >= 40 ? 'bg-warning' : 'bg-error';
  const initials = brand.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  if (collapsed) {
    return (
      <button onClick={onClick} title={brand.display_name}
        className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto text-xs font-mono font-bold transition-all ${isActive ? 'bg-accent text-bg' : 'bg-s2 text-muted hover:text-text hover:bg-border'}`}>
        {initials}
      </button>
    );
  }

  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${isActive ? 'bg-accent-dim border border-accent/30' : 'hover:bg-s2 border border-transparent'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-mono font-bold shrink-0 ${isActive ? 'bg-accent text-bg' : 'bg-s2 text-muted group-hover:text-text'}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate leading-tight ${isActive ? 'text-accent' : 'text-text'}`}>
            {brand.display_name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
              <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-mono text-muted shrink-0">{pct}%</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Phase Nav ────────────────────────────────────────────────────────────

function PhaseNav({ currentPhase, onNavigate, phase2Approved }: {
  currentPhase: number; onNavigate: (p: 1|2|3|4) => void; phase2Approved: boolean;
}) {
  return (
    <div className="flex items-center border-b border-border bg-surface px-4 overflow-x-auto shrink-0">
      {PHASES.map((p, i) => {
        const isActive = currentPhase === p.num;
        const isCompleted = currentPhase > p.num;
        const isAccessible = p.num === 1 || (p.num === 2 && currentPhase >= 2) || (p.num === 3 && phase2Approved) || (p.num === 4 && currentPhase >= 4);
        return (
          <button key={p.num} onClick={() => isAccessible && onNavigate(p.num as 1|2|3|4)} disabled={!isAccessible}
            className={`flex items-center gap-2.5 px-4 py-3.5 border-b-2 transition-all text-left shrink-0 ${isActive ? 'border-accent text-text' : isCompleted ? 'border-accent/30 text-muted hover:text-text cursor-pointer' : isAccessible ? 'border-transparent text-muted hover:text-text cursor-pointer' : 'border-transparent text-muted/30 cursor-not-allowed'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${isActive ? 'bg-accent text-bg' : isCompleted ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-border text-muted'}`}>
              {isCompleted ? <svg width="8" height="7" viewBox="0 0 8 7" fill="none"><path d="M1 3.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> : p.num}
            </div>
            <div>
              <p className="text-[11px] font-display font-semibold tracking-wide uppercase leading-tight">{p.label}</p>
              <p className="text-[10px] text-muted leading-tight">{p.desc}</p>
            </div>
            {i < PHASES.length - 1 && <span className="ml-3 text-border text-xs">›</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Onboarding View ──────────────────────────────────────────────────────

function OnboardingView({ selectedBrand, currentPhase, dispatch, onBack, onWriteComplete }: {
  selectedBrand: Brand | undefined; currentPhase: OnboardingPhase;
  dispatch: Dispatch<AppAction>; onBack: () => void; onWriteComplete: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-muted hover:text-text transition-colors text-sm font-mono group">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Dashboard
          </button>
          <span className="text-border text-xs">|</span>
          {selectedBrand ? (
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-text">{selectedBrand.display_name}</span>
              {selectedBrand.market && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-s2 text-muted border border-border">{selectedBrand.market}</span>
              )}
            </div>
          ) : (
            <span className="font-display font-bold text-base text-accent">Nueva Marca</span>
          )}
        </div>
        <span className="text-[10px] font-mono text-muted">Fase {currentPhase} de 4</span>
      </div>

      <PhaseNav currentPhase={currentPhase} onNavigate={(p) => dispatch({ type: 'SET_PHASE', phase: p })} phase2Approved={currentPhase > 2} />

      <div className="flex-1 overflow-hidden">
        {currentPhase === 1 && <Phase1Input />}
        {currentPhase === 2 && <Phase2Enrichment />}
        {currentPhase === 3 && <Phase3Gaps />}
        {currentPhase === 4 && <Phase4Summary onWriteComplete={onWriteComplete} />}
      </div>
    </div>
  );
}

// ─── Welcome Screen ──────────────────────────────────────────────────────

function WelcomeScreen({ onNewBrand, brandCount }: { onNewBrand: () => void; brandCount: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-12 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(rgba(0,255,209,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,209,1) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      <div className="text-center animate-fade-in relative z-10">
        <div className="flex items-center justify-center gap-3 mb-6">
          <h1 className="font-display font-bold text-4xl tracking-tight">
            <span className="text-text">UNREAL</span><span className="text-accent animate-pulse-accent">&gt;</span><span className="text-text">ILLE</span>
            <span className="text-muted"> ·</span><span className="text-text"> Brand Onboarding</span>
          </h1>
        </div>
        <p className="text-muted text-lg max-w-md mx-auto leading-relaxed">Write a brief. Claude extracts everything. Data goes to Supabase.</p>
        <div className="flex items-center justify-center gap-6 mt-8">
          <button onClick={onNewBrand} className="px-6 py-3 rounded-lg bg-accent text-bg font-display font-bold text-sm tracking-wide hover:bg-accent/90 transition-all hover:shadow-lg hover:shadow-accent/20">
            + Onboard New Brand
          </button>
          <div className="text-sm text-muted font-mono">or select one of {brandCount} brands →</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 max-w-2xl w-full animate-fade-in relative z-10" style={{ animationDelay: '150ms' }}>
        {PHASES.map((p) => (
          <div key={p.num} className="p-4 rounded-xl border border-border bg-surface hover:border-accent/30 transition-all">
            <div className="w-8 h-8 rounded-full bg-accent-dim border border-accent/20 flex items-center justify-center text-accent text-xs font-mono font-bold mb-3">{p.num}</div>
            <p className="font-display font-semibold text-sm text-text">{p.label}</p>
            <p className="text-[11px] text-muted mt-0.5">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
