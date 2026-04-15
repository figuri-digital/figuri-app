export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { Payment } from 'mercadopago';
import { mpClient } from '@/lib/mercadopago';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.supabase_service_role_key ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Verifica assinatura do webhook Mercado Pago.
 * Header: x-signature  →  "ts=<timestamp>,v1=<hash>"
 * Header: x-request-id →  UUID da requisição
 * Manifest: "id:<payment_id>;request-id:<request-id>;ts:<timestamp>;"
 */
function verifySignature(
  paymentId: string,
  requestId: string | null,
  rawSignature: string | null,
  secret: string
): boolean {
  if (!rawSignature || !secret) return true; // sem segredo configurado → aceitar (dev)

  const ts = rawSignature.match(/ts=([^,]+)/)?.[1];
  const v1 = rawSignature.match(/v1=([^,]+)/)?.[1];
  if (!ts || !v1) return false;

  const manifest = `id:${paymentId};request-id:${requestId ?? ''};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  return expected === v1;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Mercado Pago envia { action, api_version, data: { id }, type }
    // Aceita: payment (API de Payments) ou order (API de Orders)
    if (body.type === 'order') {
      return handleOrderWebhook(body);
    }
    if (body.type !== 'payment') {
      return NextResponse.json({ ok: true }); // ignora outros eventos
    }

    const paymentId = String(body.data?.id);
    if (!paymentId) {
      return NextResponse.json({ error: 'payment id ausente' }, { status: 400 });
    }

    // ── Verificar assinatura ──────────────────────────────────────────────
    const secret = process.env.MP_WEBHOOK_SECRET ?? '';
    const signature = request.headers.get('x-signature');
    const requestId = request.headers.get('x-request-id');

    if (secret && !verifySignature(paymentId, requestId, signature, secret)) {
      console.warn('Webhook MP: assinatura inválida para payment', paymentId);
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
    }

    // ── Buscar dados reais do pagamento ───────────────────────────────────
    const paymentClient = new Payment(mpClient);
    const payment = await paymentClient.get({ id: paymentId });

    console.log(`Webhook MP: payment ${paymentId} status=${payment.status}`);

    if (payment.status !== 'approved') {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    // ── Pagamento aprovado: registrar pedido no banco ─────────────────────
    const meta = payment.metadata ?? {};
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: dbError } = await supabase.from('orders').upsert({
      payment_id:      paymentId,
      user_id:         meta.user_id ?? null,
      image_id:        meta.image_id ?? null,
      variation_index: meta.variation_index != null ? Number(meta.variation_index) : null,
      product_type:    meta.product_type ?? 'digital',
      amount_cents:    Math.round((payment.transaction_amount ?? 0) * 100),
      status:          'paid',
      paid_at:         new Date().toISOString(),
    }, { onConflict: 'payment_id' });

    if (dbError) {
      console.error('Webhook MP: erro ao salvar order:', dbError);
      // Retorna 200 mesmo assim para evitar reenvio infinito do MP
    }

    return NextResponse.json({ ok: true, payment_id: paymentId });
  } catch (error: unknown) {
    console.error('Webhook MP error:', error);
    return NextResponse.json({ ok: true, error: 'internal' });
  }
}

// ── Handler para API de Orders ────────────────────────────────────────────────
async function handleOrderWebhook(body: { data?: { id?: string } }) {
  const orderId = String(body.data?.id ?? '');
  if (!orderId) return NextResponse.json({ ok: true });

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const order = await res.json();

    console.log(`Webhook Order ${orderId} status=${order.status}`);

    if (order.status !== 'processed') {
      return NextResponse.json({ ok: true, status: order.status });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase
      .from('orders')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('payment_id', orderId)
      .eq('status', 'pending');

    return NextResponse.json({ ok: true, order_id: orderId });
  } catch (err) {
    console.error('Order webhook error:', err);
    return NextResponse.json({ ok: true, error: 'internal' });
  }
}
