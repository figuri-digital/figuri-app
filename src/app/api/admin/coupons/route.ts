export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_KEY        = process.env.ADMIN_SECRET_KEY || 'figuri-admin-2026';

function auth(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  return key === ADMIN_KEY;
}

// ── GET — listar todos os cupons ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupons: data || [] });
}

// ── POST — criar cupom ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const body = await req.json();
  const {
    code, description, discount_type, discount_value,
    min_order_cents, max_uses, expires_at, first_purchase_only, active, applies_to,
  } = body;

  if (!code || !discount_type || discount_value === undefined) {
    return NextResponse.json({ error: 'Campos obrigatórios: code, discount_type, discount_value' }, { status: 400 });
  }

  // applies_to: null = todos; array vazio também = todos
  const appliesToVal = (Array.isArray(applies_to) && applies_to.length > 0) ? applies_to : null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.from('coupons').insert({
    code:                code.toUpperCase().trim(),
    description:         description || null,
    discount_type,
    discount_value:      parseFloat(discount_value),
    min_order_cents:     parseInt(min_order_cents || '0', 10),
    max_uses:            max_uses ? parseInt(max_uses, 10) : null,
    expires_at:          expires_at || null,
    first_purchase_only: !!first_purchase_only,
    active:              active !== false,
    applies_to:          appliesToVal,
  }).select().single();

  if (error) {
    const msg = error.message.includes('unique') ? 'Código de cupom já existe.' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ coupon: data });
}

// ── PUT — atualizar cupom ───────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.code            !== undefined) updates.code              = (fields.code as string).toUpperCase().trim();
  if (fields.description     !== undefined) updates.description       = fields.description;
  if (fields.discount_type   !== undefined) updates.discount_type     = fields.discount_type;
  if (fields.discount_value  !== undefined) updates.discount_value    = parseFloat(fields.discount_value);
  if (fields.min_order_cents !== undefined) updates.min_order_cents   = parseInt(fields.min_order_cents, 10);
  if (fields.max_uses        !== undefined) updates.max_uses          = fields.max_uses ? parseInt(fields.max_uses, 10) : null;
  if (fields.expires_at      !== undefined) updates.expires_at        = fields.expires_at || null;
  if (fields.first_purchase_only !== undefined) updates.first_purchase_only = !!fields.first_purchase_only;
  if (fields.active          !== undefined) updates.active            = !!fields.active;
  if (fields.applies_to      !== undefined) {
    updates.applies_to = (Array.isArray(fields.applies_to) && fields.applies_to.length > 0)
      ? fields.applies_to
      : null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('coupons')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupon: data });
}

// ── DELETE — excluir cupom ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { error } = await supabase.from('coupons').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
