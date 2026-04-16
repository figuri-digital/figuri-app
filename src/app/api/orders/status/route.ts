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
 * Consultado pelo carrinho a cada 3s para verificar se o PIX foi pago.
 * order_id aqui é o payment.id retornado pela Payments API (/v1/payments).
 */
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order_id');
  if (!orderId) {
    return NextResponse.json({ error: 'order_id é obrigatório' }, { status: 400 });
  }

  try {
    // Consulta o pagamento diretamente pela Payments API clássica
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(orderId)}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error('Erro ao consultar pagamento no Mercado Pago');
    }

    const payment = await res.json();

    // Status possíveis: pending, approved, authorized, in_process, in_mediation,
    //                   rejected, cancelled, refunded, charged_back
    const isPaid      = payment.status === 'approved';
    const isCancelled = payment.status === 'cancelled' || payment.status === 'rejected';

    // Se pago, atualiza o banco
    if (isPaid) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('orders')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('payment_id', orderId)
          .eq('status', 'pending');
      } catch (dbEx) {
        console.error('[orders/status] DB update error (non-fatal):', dbEx);
      }
    }

    return NextResponse.json(
      {
        status:    isPaid ? 'paid' : isCancelled ? 'cancelled' : 'pending',
        mp_status: payment.status,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Order status error:', error);
    const message = error instanceof Error ? error.message : 'Erro ao consultar pedido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
