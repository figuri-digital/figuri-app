export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.supabase_service_role_key ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'figuri-admin-2026';

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const steps: { step: string; ok: boolean; detail?: string }[] = [];

  // 1. Verifica se a coluna text_colors já existe
  const { data: cols, error: colErr } = await supabase
    .from('figurinha_configs')
    .select('text_colors')
    .limit(1);

  const colExists = !colErr || !colErr.message?.includes('text_colors');

  steps.push({
    step: 'Verificar coluna text_colors',
    ok: colExists,
    detail: colExists ? 'Coluna existe' : `Coluna ausente: ${colErr?.message}`,
  });

  if (!colExists) {
    // 2. Adiciona a coluna via rpc exec_sql (requer pg_net ou função customizada)
    // Alternativa: usar a API REST do Supabase Management
    // Como o JS client não suporta DDL diretamente, usamos o endpoint de management
    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
    const serviceKey = supabaseServiceKey;

    const ddl = `
      ALTER TABLE figurinha_configs
        ADD COLUMN IF NOT EXISTS text_colors JSONB NOT NULL
        DEFAULT '{"01":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"02":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"03":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"04":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"}}'::jsonb;
      ALTER TABLE figurinha_configs DROP COLUMN IF EXISTS text_color;
    `;

    try {
      const mgmtRes = await fetch(
        `https://api.supabase.com/v1/projects/${projectId}/database/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ query: ddl }),
        }
      );

      if (mgmtRes.ok) {
        steps.push({ step: 'Criar coluna text_colors', ok: true, detail: 'Coluna criada com sucesso' });
      } else {
        const errText = await mgmtRes.text();
        steps.push({ step: 'Criar coluna text_colors', ok: false, detail: errText.slice(0, 200) });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      steps.push({ step: 'Criar coluna text_colors', ok: false, detail: message });
    }
  }

  // 3. Migra linhas existentes com formato legado (text_color string → text_colors JSONB)
  if (colExists) {
    const DEFAULT_COLORS = { '01': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' }, '02': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' }, '03': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' }, '04': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' } };

    const { data: rows } = await supabase.from('figurinha_configs').select('id, text_colors');
    let migrated = 0;

    for (const row of (rows || [])) {
      const tc = row.text_colors;
      if (!tc) {
        await supabase.from('figurinha_configs').update({ text_colors: DEFAULT_COLORS }).eq('id', row.id);
        migrated++;
        continue;
      }
      // Check if any value is a string (legacy format)
      const needsMigration = Object.values(tc).some(v => typeof v === 'string');
      if (needsMigration) {
        const fixed: Record<string, { name: string; birth: string; height: string }> = {};
        for (const [k, v] of Object.entries(tc)) {
          if (typeof v === 'string') {
            fixed[k] = { name: v as string, birth: v as string, height: v as string };
          } else {
            fixed[k] = v as { name: string; birth: string; height: string };
          }
        }
        await supabase.from('figurinha_configs').update({ text_colors: fixed }).eq('id', row.id);
        migrated++;
      }
    }

    steps.push({ step: 'Migrar linhas legadas', ok: true, detail: `${migrated} linhas migradas` });
  }

  const allOk = steps.every(s => s.ok);
  return NextResponse.json({ ok: allOk, steps }, { status: allOk ? 200 : 500 });
}
