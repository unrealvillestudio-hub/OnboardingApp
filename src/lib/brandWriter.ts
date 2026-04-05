/**
 * brandWriter.ts
 * Orchestrates UPSERT into all Supabase tables from a finalized onboarding session.
 */

import { sbUpsert, sbUpdate } from './supabaseClient';
import type {
  Brand,
  StructuredBrandContext,
  WriteResult,
  TableWriteStatus,
  BrandGoalDraft,
  BrandPersonaDraft,
  GeoMixDraft,
} from '@/types';

export async function writeBrandToSupabase(
  brandId: string,
  ctx: StructuredBrandContext,
  gapData: Record<string, unknown>
): Promise<WriteResult> {
  const results: TableWriteStatus[] = [];
  const ts = new Date().toISOString();

  // ── 1. brands table ──────────────────────────────────────────────────────
  try {
    const brandPayload: Partial<Brand> = {
      id: brandId,
      display_name: ctx.display_name,
      type: ctx.type,
      market: ctx.market,
      language_primary: ctx.language_primary,
      brand_context: ctx.brand_context,
      brand_story: ctx.brand_story,
      icp: ctx.icp,
      key_messages: ctx.key_messages,
      competitors: ctx.competitors,
      differentiators: ctx.differentiators,
      diferenciador_base: ctx.diferenciador_base,
      geo_principal: ctx.geo_principal,
      tono_base: ctx.tono_base,
      canal_base: ctx.canal_base,
      canales_activos: ctx.canales_activos,
      formatos_activos: ctx.formatos_activos,
      cta_base: ctx.cta_base,
      disclaimer_base: ctx.disclaimer_base,
      url_base: ctx.url_base,
      // merge gap data overrides
      ...(gapData.brands as Partial<Brand> | undefined),
    };
    await sbUpsert<Brand>('brands', brandPayload, 'id');
    results.push({ table: 'brands', rowsUpserted: 1, status: 'success' });
  } catch (e) {
    results.push({ table: 'brands', rowsUpserted: 0, status: 'error', reason: String(e) });
  }

  // ── 2. humanize_profiles ──────────────────────────────────────────────────
  if (ctx.humanize_profiles?.length) {
    try {
      const rows = ctx.humanize_profiles.map((p) => ({
        brand_id: brandId,
        medium: p.medium,
        voice_tone: p.voice_tone,
        vocabulary_level: p.vocabulary_level,
        authenticity_markers: p.authenticity_markers,
        avoid_patterns: p.avoid_patterns,
      }));
      await sbUpsert('humanize_profiles', rows, 'brand_id,medium');
      results.push({
        table: 'humanize_profiles',
        rowsUpserted: rows.length,
        status: 'success',
      });
    } catch (e) {
      results.push({
        table: 'humanize_profiles',
        rowsUpserted: 0,
        status: 'error',
        reason: String(e),
      });
    }
  } else {
    results.push({
      table: 'humanize_profiles',
      rowsUpserted: 0,
      status: 'skipped',
      reason: 'No profiles generated',
    });
  }

  // ── 3. compliance_rules ───────────────────────────────────────────────────
  if (ctx.compliance_rules?.length) {
    try {
      const rows = ctx.compliance_rules.map((r) => ({
        brand_id: brandId,
        rule_type: r.rule_type,
        rule_text: r.rule_text,
        applies_to: r.applies_to,
      }));
      await sbUpsert('compliance_rules', rows, 'brand_id,rule_type');
      results.push({
        table: 'compliance_rules',
        rowsUpserted: rows.length,
        status: 'success',
      });
    } catch (e) {
      results.push({
        table: 'compliance_rules',
        rowsUpserted: 0,
        status: 'error',
        reason: String(e),
      });
    }
  } else {
    results.push({
      table: 'compliance_rules',
      rowsUpserted: 0,
      status: 'skipped',
      reason: 'No rules generated',
    });
  }

  // ── 4. brand_palette (suggestions only, if provided) ─────────────────────
  if (ctx.palette_suggestion) {
    try {
      const p = ctx.palette_suggestion;
      const rows = [
        { brand_id: brandId, role: 'primary', hex: p.primary },
        { brand_id: brandId, role: 'secondary', hex: p.secondary },
        { brand_id: brandId, role: 'accent', hex: p.accent },
        { brand_id: brandId, role: 'background', hex: p.background },
        { brand_id: brandId, role: 'text', hex: p.text },
      ];
      await sbUpsert('brand_palette', rows, 'brand_id,role');
      results.push({ table: 'brand_palette', rowsUpserted: rows.length, status: 'success' });
    } catch (e) {
      results.push({ table: 'brand_palette', rowsUpserted: 0, status: 'error', reason: String(e) });
    }
  } else {
    results.push({
      table: 'brand_palette',
      rowsUpserted: 0,
      status: 'skipped',
      reason: 'No palette suggested',
    });
  }

  // ── 5. brand_typography ───────────────────────────────────────────────────
  if (ctx.typography_suggestion) {
    try {
      const t = ctx.typography_suggestion;
      const rows = [
        { brand_id: brandId, role: 'heading', font_name: t.heading_font },
        { brand_id: brandId, role: 'body', font_name: t.body_font },
      ];
      await sbUpsert('brand_typography', rows, 'brand_id,role');
      results.push({
        table: 'brand_typography',
        rowsUpserted: rows.length,
        status: 'success',
      });
    } catch (e) {
      results.push({
        table: 'brand_typography',
        rowsUpserted: 0,
        status: 'error',
        reason: String(e),
      });
    }
  } else {
    results.push({
      table: 'brand_typography',
      rowsUpserted: 0,
      status: 'skipped',
      reason: 'No typography suggested',
    });
  }


  // ── 6. brand_goals ──────────────────────────────────────────────────────
  if (ctx.brand_goals?.length) {
    try {
      const rows = ctx.brand_goals.map((g, i) => ({
        brand_id: brandId,
        horizon: g.horizon,
        category: g.category,
        goal: g.goal,
        kpi: g.kpi,
        target: g.target,
        priority: g.priority ?? i + 1,
        status: 'active',
        notes: g.notes ?? null,
      }));
      await sbUpsert('brand_goals', rows, 'brand_id,category,goal');
      results.push({ table: 'brand_goals', rowsUpserted: rows.length, status: 'success' });
    } catch (e) {
      results.push({ table: 'brand_goals', rowsUpserted: 0, status: 'error', reason: String(e) });
    }
  } else {
    results.push({ table: 'brand_goals', rowsUpserted: 0, status: 'skipped', reason: 'No goals generated' });
  }

  // ── 7. brand_personas ─────────────────────────────────────────────────────
  if (ctx.brand_personas?.length) {
    try {
      const rows = ctx.brand_personas.map((p) => ({
        brand_id: brandId,
        persona_key: p.persona_key,
        label: p.label,
        segment_type: p.segment_type,
        priority: p.priority,
        age_range: p.age_range,
        gender: p.gender,
        location: p.location,
        language: p.language,
        income_level: p.income_level,
        pain_points: p.pain_points,
        motivations: p.motivations,
        objections: p.objections,
        values: p.values,
        channels: p.channels,
        buying_trigger: p.buying_trigger,
        tone_for_segment: p.tone_for_segment,
        copy_hooks: p.copy_hooks,
        avoid: p.avoid,
        data_source: 'onboarding_ai',
        confidence: p.confidence ?? 70,
        active: true,
        notes: p.notes ?? null,
      }));
      await sbUpsert('brand_personas', rows, 'brand_id,persona_key');
      results.push({ table: 'brand_personas', rowsUpserted: rows.length, status: 'success' });
    } catch (e) {
      results.push({ table: 'brand_personas', rowsUpserted: 0, status: 'error', reason: String(e) });
    }
  } else {
    results.push({ table: 'brand_personas', rowsUpserted: 0, status: 'skipped', reason: 'No personas generated' });
  }

  // ── 8. geomix ─────────────────────────────────────────────────────────────
  if (ctx.geomix?.length) {
    try {
      const rows = ctx.geomix.map((g) => ({
        brand_id: brandId,
        geo: g.geo,
        country: g.country,
        region: g.region,
        city: g.city,
        language: g.language,
        lighting: g.lighting,
        color_mood: g.color_mood,
        aesthetic: g.aesthetic,
        local_slang: g.local_slang,
        avoid_slang: g.avoid_slang,
        cultural_refs: g.cultural_refs,
        active: true,
      }));
      await sbUpsert('geomix', rows, 'brand_id,geo');
      results.push({ table: 'geomix', rowsUpserted: rows.length, status: 'success' });
    } catch (e) {
      results.push({ table: 'geomix', rowsUpserted: 0, status: 'error', reason: String(e) });
    }
  } else {
    results.push({ table: 'geomix', rowsUpserted: 0, status: 'skipped', reason: 'No geomix generated' });
  }

  return {
    success: results.every((r) => r.status !== 'error'),
    tablesWritten: results,
    timestamp: ts,
  };
}
