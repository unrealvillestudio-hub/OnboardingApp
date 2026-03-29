/**
 * supabaseClient.ts
 * Fetch-native Supabase REST client — no SDK, mirrors CopyLab pattern.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Supabase] Missing env vars: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

const BASE = `${SUPABASE_URL}/rest/v1`;

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: 'return=representation',
    ...extra,
  };
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

export async function sbSelect<T>(
  table: string,
  query: string = '*',
  filters?: Record<string, string>
): Promise<T[]> {
  const params = new URLSearchParams({ select: query });
  if (filters) {
    for (const [key, val] of Object.entries(filters)) {
      params.set(key, val);
    }
  }
  const res = await fetch(`${BASE}/${table}?${params}`, {
    method: 'GET',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`[Supabase] SELECT ${table} failed: ${await res.text()}`);
  return res.json();
}

export async function sbUpsert<T>(
  table: string,
  data: Partial<T> | Partial<T>[],
  onConflict?: string
): Promise<T[]> {
  const params = new URLSearchParams();
  if (onConflict) params.set('on_conflict', onConflict);

  const res = await fetch(`${BASE}/${table}${params.toString() ? '?' + params : ''}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation,resolution=merge-duplicates' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`[Supabase] UPSERT ${table} failed: ${await res.text()}`);
  return res.json();
}

export async function sbUpdate<T>(
  table: string,
  data: Partial<T>,
  filters: Record<string, string>
): Promise<T[]> {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${BASE}/${table}?${params}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`[Supabase] UPDATE ${table} failed: ${await res.text()}`);
  return res.json();
}

// ─── Domain queries ───────────────────────────────────────────────────────────

import type { Brand } from '@/types';

/** All brands ordered by display_name */
export async function fetchAllBrands(): Promise<Brand[]> {
  return sbSelect<Brand>('brands', '*', { order: 'display_name.asc' });
}

/** Count of humanize_profile rows per brand_id */
export async function fetchHumanizeProfileCounts(): Promise<Record<string, number>> {
  const rows = await sbSelect<{ brand_id: string; count: string }>(
    'humanize_profiles',
    'brand_id,count',
    { select: 'brand_id' }
  );
  // Group manually since we can't use aggregates easily without RPC
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    counts[r.brand_id] = (counts[r.brand_id] || 0) + 1;
  });
  return counts;
}

/** Count of palette rows per brand_id */
export async function fetchPaletteCounts(): Promise<Record<string, number>> {
  const rows = await sbSelect<{ brand_id: string }>('brand_palette', 'brand_id');
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    counts[r.brand_id] = (counts[r.brand_id] || 0) + 1;
  });
  return counts;
}

/** Count of typography rows per brand_id */
export async function fetchTypographyCounts(): Promise<Record<string, number>> {
  const rows = await sbSelect<{ brand_id: string }>('brand_typography', 'brand_id');
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    counts[r.brand_id] = (counts[r.brand_id] || 0) + 1;
  });
  return counts;
}
