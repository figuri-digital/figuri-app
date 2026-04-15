export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Payment } from 'mercadopago';
import { mpClient } from '@/lib/mercadopago';

/**
 * GET /api/checkout/status?payment_id=xxxxx
 * Consultado pelo frontend a cada 3 segundos para verificar se o PIX foi pago.
 * Retorna: { status: 'pending' | 'approved' | 'rejected' | 'cancelled', metadata }
 */
export async function GET(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get('payment_id');

  if (!paymentId) {
    return NextResponse.json({ error: 'payment_id é obrigatório' }, { status: 400 });
  }

  try {
    const paymentClient = new Payment(mpClient);
    const payment = await paymentClient.get({ id: paymentId });

    return NextResponse.json(
      {
        status:         payment.status,         // pending | approved | rejected | cancelled
        status_detail:  payment.status_detail,
        imageId:        payment.metadata?.image_id,
        variationIndex: payment.metadata?.variation_index,
        userId:         payment.metadata?.user_id,
        productType:    payment.metadata?.product_type,
        amount:         payment.transaction_amount,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Payment status error:', error);
    const message = error instanceof Error ? error.message : 'Erro ao consultar pagamento';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
