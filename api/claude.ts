/**
 * src/api/claude.ts — UNRLVL Onboarding App
 * Client-side wrapper for /api/claude proxy.
 * callClaudeJSON  → structured JSON responses (Phases 1-4)
 * callClaude      → plain text responses (ChatPanel)
 */

const ENDPOINT = '/api/claude';

interface ClaudeRequest {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  max_tokens?: number;
  temperature?: number;
}

// ── callClaudeJSON ─────────────────────────────────────────────────────────
// Returns parsed JSON. Used in Phase2Enrichment, Phase3Gaps, BrandGapView.

export async function callClaudeJSON<T = unknown>(req: ClaudeRequest): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: req.system,
      messages: req.messages,
      max_tokens: req.max_tokens ?? 4096,
      temperature: req.temperature ?? 0.5,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Extract text content from response
  const raw: string =
    data?.content?.[0]?.text ??
    data?.text ??
    data?.message ??
    JSON.stringify(data);

  // Strip markdown code fences if present
  const clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${clean.slice(0, 200)}`);
  }
}

// ── callClaude ─────────────────────────────────────────────────────────────
// Returns plain text string. Used in ChatPanel.

export async function callClaude(req: ClaudeRequest): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: req.system,
      messages: req.messages,
      max_tokens: req.max_tokens ?? 2048,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  return (
    data?.content?.[0]?.text ??
    data?.text ??
    data?.message ??
    'Sin respuesta.'
  );
}
