export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.supabase_service_role_key ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'figuri-admin-2026';

const MIGRATION_SQL = `-- Cole este SQL no Supabase SQL Editor e execute:
-- https://supabase.com/dashboard/project/ytzkwhozesiomcvmkgyl/sql/new

ALTER TABLE figurinha_configs
  ADD COLUMN IF NOT EXISTS text_colors JSONB NOT NULL
  DEFAULT '{"01":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"02":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"03":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"04":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"}}'::jsonb;

ALTER TABLE figurinha_configs DROP COLUMN IF EXISTS text_color;`;

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Detecta se a coluna text_colors existe tentando lê-la
  const { error: readErr } = await supabase
    .from('figurinha_configs')
    .select('id, text_colors')
    .limit(1);

  const colMissing = !!readErr && (
    readErr.message?.includes('text_colors') ||
    readErr.code === '42703'
  );

  if (colMissing) {
    // Coluna não existe — retorna o SQL para o usuário executar manualmente
    return NextResponse.json({
      ok: false,
      needs_manual_sql: true,
      sql: MIGRATION_SQL,
      supabase_url: `https://supabase.com/dashboard/project/${supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1]}/sql/new`,
      message: 'A coluna text_colors não existe no banco. Execute o SQL abaixo no Supabase Dashboard.',
    }, { status: 200 });
  }

  if (readErr) {
    return NextResponse.json({
      ok: false,
      needs_manual_sql: false,
      message: `Erro ao ler tabela: ${readErr.message}`,
    }, { status: 500 });
  }

  // 2. Coluna existe — migra linhas com formato legado (string → objeto)
  const { data: rows, error: rowsErr } = await supabase
    .from('figurinha_configs')
    .select('id, text_colors');

  if (rowsErr) {
    return NextResponse.json({ ok: false, message: `Erro ao listar linhas: ${rowsErr.message}` }, { status: 500 });
  }

  const DEFAULT_COLORS = {
    '01': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' },
    '02': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' },
    '03': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' },
    '04': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' },
  };

  let migrated = 0;
  for (const row of (rows || [])) {
    const tc = row.text_colors;
    if (!tc) {
      await supabase.from('figurinha_configs').update({ text_colors: DEFAULT_COLORS }).eq('id', row.id);
      migrated++;
      continue;
    }
    const needsMigration = typeof tc === 'string' || Object.values(tc).some(v => typeof v === 'string');
    if (needsMigration) {
      const fixed: Record<string, { name: string; birth: string; height: string }> = {};
      const source = typeof tc === 'string' ? {} : tc;
      for (const m of ['01', '02', '03', '04']) {
        const val = source[m];
        if (!val) fixed[m] = { ...DEFAULT_COLORS['01'] };
        else if (typeof val === 'string') fixed[m] = { name: val, birth: val, height: val };
        else fixed[m] = val as { name: string; birth: string; height: string };
      }
      await supabase.from('figurinha_configs').update({ text_colors: fixed }).eq('id', row.id);
      migrated++;
    }
  }

  // 3. Faz um teste de escrita e leitura para confirmar que o save funciona
  const testRow = rows?.[0];
  let writeTestOk = true;
  let writeTestDetail = 'Sem linhas para testar';

  if (testRow) {
    const currentColors = testRow.text_colors || DEFAULT_COLORS;
    const { error: writeErr } = await supabase
      .from('figurinha_configs')
      .update({ text_colors: currentColors })
      .eq('id', testRow.id);

    if (writeErr) {
      writeTestOk = false;
      writeTestDetail = `Falha ao escrever text_colors: ${writeErr.message}`;
    } else {
      // Lê de volta para confirmar
      const { data: readBack, error: readBackErr } = await supabase
        .from('figurinha_configs')
        .select('text_colors')
        .eq('id', testRow.id)
        .single();

      if (readBackErr || !readBack?.text_colors) {
        writeTestOk = false;
        writeTestDetail = `Escreveu mas não leu de volta: ${readBackErr?.message}`;
      } else {
        writeTestDetail = 'Escrita e leitura de text_colors funcionando corretamente ✅';
      }
    }
  }

  return NextResponse.json({
    ok: writeTestOk,
    needs_manual_sql: false,
    migrated_rows: migrated,
    write_test: { ok: writeTestOk, detail: writeTestDetail },
    message: writeTestOk
      ? `Banco OK. ${migrated} linhas migradas. ${writeTestDetail}`
      : writeTestDetail,
  });
}
