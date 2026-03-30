/**
 * onboardingStore.ts
 * Central state for an active onboarding session.
 * Uses React Context + useReducer — no external deps.
 * v1.1 — added chatMessages + isChatOpen for ChatPanel
 */

import { createContext, useContext, useReducer, type Dispatch } from 'react';
import type {
  OnboardingSession,
  OnboardingPhase,
  StructuredBrandContext,
  GapMessage,
  WriteResult,
} from '@/types';

// ── Chat Message type ─────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

// ── Initial State ─────────────────────────────────────────────────────────

const initialSession: OnboardingSession & {
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
} = {
  targetBrandId: null,
  isNewBrand: false,
  freeBrief: '',
  structuredContext: null,
  phase2Approved: false,
  gapMessages: [],
  gapData: {},
  writeResult: null,
  currentPhase: 1,
  isLoading: false,
  error: null,
  chatMessages: [],
  isChatOpen: false,
};

// ── Actions ───────────────────────────────────────────────────────────────

type Action =
  | { type: 'START_NEW'; brandId: string }
  | { type: 'EDIT_EXISTING'; brandId: string }
  | { type: 'SET_BRIEF'; brief: string }
  | { type: 'SET_PHASE'; phase: OnboardingPhase }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_STRUCTURED_CONTEXT'; ctx: StructuredBrandContext }
  | { type: 'UPDATE_STRUCTURED_FIELD'; field: keyof StructuredBrandContext; value: unknown }
  | { type: 'APPROVE_PHASE2' }
  | { type: 'ADD_GAP_MESSAGE'; message: GapMessage }
  | { type: 'MERGE_GAP_DATA'; data: Record<string, unknown> }
  | { type: 'SET_WRITE_RESULT'; result: WriteResult }
  | { type: 'RESET' }
  // Chat actions
  | { type: 'TOGGLE_CHAT' }
  | { type: 'SET_CHAT_OPEN'; open: boolean }
  | { type: 'ADD_CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'CLEAR_CHAT' };

// ── Reducer ───────────────────────────────────────────────────────────────

type FullSession = typeof initialSession;

function reducer(state: FullSession, action: Action): FullSession {
  switch (action.type) {
    case 'START_NEW':
      return { ...initialSession, targetBrandId: action.brandId, isNewBrand: true };

    case 'EDIT_EXISTING':
      return {
        ...initialSession,
        targetBrandId: action.brandId,
        isNewBrand: false,
        // Preserve chat state when switching brands
        isChatOpen: state.isChatOpen,
        chatMessages: [],
      };

    case 'SET_BRIEF':
      return { ...state, freeBrief: action.brief };

    case 'SET_PHASE':
      return { ...state, currentPhase: action.phase, error: null };

    case 'SET_LOADING':
      return { ...state, isLoading: action.loading };

    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };

    case 'SET_STRUCTURED_CONTEXT':
      return { ...state, structuredContext: action.ctx, isLoading: false };

    case 'UPDATE_STRUCTURED_FIELD':
      if (!state.structuredContext) return state;
      return {
        ...state,
        structuredContext: {
          ...state.structuredContext,
          [action.field]: action.value,
        },
      };

    case 'APPROVE_PHASE2':
      return { ...state, phase2Approved: true, currentPhase: 3 };

    case 'ADD_GAP_MESSAGE':
      return { ...state, gapMessages: [...state.gapMessages, action.message] };

    case 'MERGE_GAP_DATA':
      return { ...state, gapData: { ...state.gapData, ...action.data } };

    case 'SET_WRITE_RESULT':
      return { ...state, writeResult: action.result, isLoading: false };

    case 'RESET':
      return { ...initialSession, isChatOpen: state.isChatOpen };

    // Chat
    case 'TOGGLE_CHAT':
      return { ...state, isChatOpen: !state.isChatOpen };

    case 'SET_CHAT_OPEN':
      return { ...state, isChatOpen: action.open };

    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.message] };

    case 'CLEAR_CHAT':
      return { ...state, chatMessages: [] };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────

interface StoreContextValue {
  session: FullSession;
  dispatch: Dispatch<Action>;
}

export const OnboardingStoreContext = createContext<StoreContextValue | null>(null);

export function createOnboardingStore(): [FullSession, Dispatch<Action>] {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useReducer(reducer, initialSession);
}

export function useOnboardingStore(): StoreContextValue {
  const ctx = useContext(OnboardingStoreContext);
  if (!ctx) throw new Error('useOnboardingStore must be used inside OnboardingStoreContext.Provider');
  return ctx;
}

// ── Completeness Calculator ───────────────────────────────────────────────

import type { Brand, BrandCompleteness } from '@/types';

const COMPLETENESS_FIELDS: Array<keyof Brand> = [
  'brand_context',
  'brand_story',
  'icp',
  'key_messages',
  'competitors',
  'differentiators',
  'diferenciador_base',
  'tono_base',
  'geo_principal',
  'canal_base',
  'canales_activos',
  'cta_base',
  'disclaimer_base',
  'url_base',
];

export function computeCompleteness(
  brand: Brand,
  extraCounts: { humanize: number; palette: number; typography: number }
): BrandCompleteness {
  const missing: string[] = [];
  let filled = 0;

  for (const field of COMPLETENESS_FIELDS) {
    const val = brand[field];
    const isEmpty =
      val === null ||
      val === undefined ||
      val === '' ||
      (Array.isArray(val) && val.length === 0);
    if (isEmpty) {
      missing.push(field);
    } else {
      filled++;
    }
  }

  const extras = [
    { name: 'humanize_profiles', count: extraCounts.humanize },
    { name: 'brand_palette', count: extraCounts.palette },
    { name: 'brand_typography', count: extraCounts.typography },
  ];
  const extraTotal = extras.length;
  let extraFilled = 0;
  for (const e of extras) {
    if (e.count > 0) extraFilled++;
    else missing.push(e.name);
  }

  const totalFields = COMPLETENESS_FIELDS.length + extraTotal;
  const totalFilled = filled + extraFilled;

  return {
    brandId: brand.id,
    percent: Math.round((totalFilled / totalFields) * 100),
    filledFields: totalFilled,
    totalFields,
    missingFields: missing,
  };
}
