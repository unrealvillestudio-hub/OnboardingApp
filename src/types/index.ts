// ─── Brand Types ──────────────────────────────────────────────────────────────

export type BrandStatus = 'active' | 'draft' | 'paused' | 'archived';
export type BrandType = 'cosmetics' | 'supplements' | 'services' | 'personal' | 'community' | 'b2b' | string;

/** Raw row from Supabase `brands` table */
export interface Brand {
  id: string;
  display_name: string;
  type: BrandType | null;
  market: string | null;
  language_primary: string | null;
  status: BrandStatus | null;
  // Context & narrative
  brand_context: string | null;
  brand_story: string | null;
  icp: string | null;
  key_messages: string[] | null;
  competitors: string[] | null;
  differentiators: string[] | null;
  diferenciador_base: string | null;
  // Geo & channels
  geo_principal: string | null;
  canal_base: string | null;
  canales_activos: string[] | null;
  formatos_activos: string[] | null;
  // Copy
  tono_base: string | null;
  cta_base: string | null;
  cta_ab_testing: string | null;
  cta_ads: string | null;
  disclaimer_base: string | null;
  url_base: string | null;
  cta_url_base: string | null;
}

/** Derived metric for the sidebar */
export interface BrandCompleteness {
  brandId: string;
  percent: number;
  filledFields: number;
  totalFields: number;
  missingFields: string[];
}

// ─── Onboarding Session ───────────────────────────────────────────────────────

export type OnboardingPhase = 1 | 2 | 3 | 4;

export interface OnboardingSession {
  // Which brand are we onboarding/editing
  targetBrandId: string | null;
  isNewBrand: boolean;

  // Phase 1: Free brief
  freeBrief: string;

  // Phase 2: Claude-enriched structured output
  structuredContext: StructuredBrandContext | null;
  phase2Approved: boolean;

  // Phase 3: Gap interview
  gapMessages: GapMessage[];
  gapData: Record<string, unknown>;

  // Phase 4: Write summary
  writeResult: WriteResult | null;

  // Navigation
  currentPhase: OnboardingPhase;
  isLoading: boolean;
  error: string | null;
}

/** The structured output Claude generates in Phase 2 */
export interface StructuredBrandContext {
  // mirrors brands table
  display_name: string;
  type: string;
  market: string;
  language_primary: string;
  brand_context: string;
  brand_story: string;
  icp: string;
  key_messages: string[];
  competitors: string[];
  differentiators: string[];
  diferenciador_base: string;
  geo_principal: string;
  tono_base: string;
  canal_base: string;
  canales_activos: string[];
  formatos_activos: string[];
  cta_base: string;
  disclaimer_base: string;
  url_base: string;
  // extended tables
  humanize_profiles: HumanizeProfileDraft[];
  compliance_rules: ComplianceRuleDraft[];
  palette_suggestion: PaletteSuggestion | null;
  typography_suggestion: TypographySuggestion | null;
  // Phase 4 extended tables
  brand_goals: BrandGoalDraft[];
  brand_personas: BrandPersonaDraft[];
  geomix: GeoMixDraft[];
  // meta
  detected_industry: string;
  applied_compliance_framework: string;
  claude_reasoning: Record<string, string>; // field → explanation
}

export interface HumanizeProfileDraft {
  medium: string;
  voice_tone: string;
  vocabulary_level: string;
  authenticity_markers: string[];
  avoid_patterns: string[];
}

export interface ComplianceRuleDraft {
  rule_type: string;
  rule_text: string;
  applies_to: string[];
}

export interface PaletteSuggestion {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface TypographySuggestion {
  heading_font: string;
  body_font: string;
  mono_font: string;
}

// Phase 3
export interface GapMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
}


// ─── Brand Goals Draft ────────────────────────────────────────────────────────

export interface BrandGoalDraft {
  horizon: 'short' | 'mid' | 'long';
  category: string;
  goal: string;
  kpi: string;
  target: string;
  priority: number;
  notes?: string;
}

// ─── Brand Persona Draft ──────────────────────────────────────────────────────

export interface BrandPersonaDraft {
  persona_key: string;
  label: string;
  segment_type: string;
  priority: number;
  age_range: string;
  gender: string;
  location: string;
  language: string;
  income_level: string;
  pain_points: string[];
  motivations: string[];
  objections: string[];
  values: string[];
  channels: string[];
  buying_trigger: string;
  tone_for_segment: string;
  copy_hooks: string[];
  avoid: string[];
  confidence: number;
  notes?: string;
}

// ─── GeoMix Draft ─────────────────────────────────────────────────────────────

export interface GeoMixDraft {
  geo: string;
  country: string;
  region: string;
  city: string;
  language: string;
  lighting: string;
  color_mood: string;
  aesthetic: string;
  local_slang: string[];
  avoid_slang: string[];
  cultural_refs: string[];
}

// Phase 4
export interface WriteResult {
  success: boolean;
  tablesWritten: TableWriteStatus[];
  timestamp: string;
}

export interface TableWriteStatus {
  table: string;
  rowsUpserted: number;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequest {
  system?: string;
  messages: ClaudeMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}
