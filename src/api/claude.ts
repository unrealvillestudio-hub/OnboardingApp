/**
 * src/api/claude.ts — client-side fetch wrapper
 * Calls /api/claude (Vercel serverless proxy)
 */

import type { ClaudeRequest, ClaudeResponse } from '@/types';

export async function callClaude(req: ClaudeRequest): Promise<string> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data: ClaudeResponse = await res.json();
  const textBlock = data.content?.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text block in Claude response');
  return textBlock.text;
}

/** Call Claude and expect a JSON response — strips markdown fences */
export async function callClaudeJSON<T>(req: ClaudeRequest): Promise<T> {
  const raw = await callClaude(req);
  const clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new Error(`Failed to parse Claude JSON response:\n${clean.slice(0, 500)}`);
  }
}
