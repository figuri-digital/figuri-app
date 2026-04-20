export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Coupon {
  id:                  string;
  code:                string;
  description:         string | null;
  discount_type:       string;
  discount_value:      number;
  min_order_cents:     number;
  max_uses:            number | null;
  uses_count:          number;
  expires_at:          string | null;
  first_purchase_only: boolean;
  active:              boolean;
}

export async function POST(req: NextRequest) {
  try {
    const { code, order_cents, user_id } = await req.json();

    if (!code || !order_cents) {
      return NextResponse.json({ error: 'Código e valor do pedido são obrigatórios' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca o cupom
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', (code as string).toUpperCase().trim())
      .single<Coupon>();

    if (error || !coupon) {
      return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 });
    }

    // Validações
    if (!coupon.active) {
      return NextResponse.json({ error: 'Cupom inativo' }, { status: 400 });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Cupom expirado' }, { status: 400 });
    }

    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
      return NextResponse.json({ error: 'Cupom esgotado' }, { status: 400 });
    }

    if (order_cents < coupon.min_order_cents) {
      const minBRL = (coupon.min_order_cents / 100).toFixed(2).replace('.', ',');
      return NextResponse.json({ error: `Pedido mínimo para este cupom: R$ ${minBRL}` }, { status: 400 });
    }

    // Valida primeira compra
    if (coupon.first_purchase_only && user_id) {
      const { data: prevOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', user_id)
        .eq('status', 'paid')
        .limit(1);
      if (prevOrders && prevOrders.length > 0) {
        return NextResponse.json({ error: 'Este cupom é válido somente para a primeira compra' }, { status: 400 });
      }
    }

    // Calcula desconto
    let discount_cents: number;
    if (coupon.discount_type === 'percent') {
      discount_cents = Math.round((order_cents * coupon.discount_value) / 100);
    } else {
      discount_cents = Math.round(coupon.discount_value);
    }
    discount_cents = Math.min(discount_cents, order_cents); // desconto não pode ser maior que o total

    return NextResponse.json({
      valid:            true,
      coupon_id:        coupon.id,
      code:             coupon.code,
      description:      coupon.description,
      discount_type:    coupon.discount_type,
      discount_value:   coupon.discount_value,
      discount_cents,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao validar cupom';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
