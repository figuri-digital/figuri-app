export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.supabase_service_role_key ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/orders/status?order_id=xxxxx
 * Consultado pelo carrinho a cada 3s para verificar se o pedido foi pago.
 */
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order_id');
  if (!orderId) {
    return NextResponse.json({ error: 'order_id é obrigatório' }, { status: 400 });
  }

  try {
    // 1. Consulta o Mercado Pago diretamente
    const res = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error('Erro ao consultar order no Mercado Pago');
    }

    const order = await res.json();

    // Status possíveis: open, action_required, processed, expired, canceled
    const isPaid = order.status === 'processed';
    const isCancelled = order.status === 'expired' || order.status === 'canceled';

    // 2. Se pago, atualiza o banco
    if (isPaid) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('payment_id', orderId)
        .eq('status', 'pending');
    }

    return NextResponse.json(
      {
        status:  isPaid ? 'paid' : isCancelled ? 'cancelled' : 'pending',
        mp_status: order.status,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Order status error:', error);
    const message = error instanceof Error ? error.message : 'Erro ao consultar pedido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
