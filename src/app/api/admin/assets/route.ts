export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'figuri-admin-2026';
const BUCKET = 'images';
const ADMIN_PREFIX = 'admin';

// ── POST — upload a file to Supabase Storage ─────────────────────────────────

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const folder = (formData.get('folder') as string) || 'layouts';

  if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${ADMIN_PREFIX}/${folder}/${Date.now()}-${safeName}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type || 'image/png',
    upsert: true,
  });

  if (error) {
    console.error('Asset upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return NextResponse.json({ url: urlData.publicUrl, path: storagePath });
}

// ── DELETE — remove a file from Supabase Storage ─────────────────────────────

export async function DELETE(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { path } = await req.json();
  if (!path) return NextResponse.json({ error: 'Path obrigatório' }, { status: 400 });

  // Safety: only admin/ prefix can be deleted
  if (!path.startsWith(`${ADMIN_PREFIX}/`)) {
    return NextResponse.json({ error: 'Só é possível remover arquivos do admin' }, { status: 403 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    console.error('Asset delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
