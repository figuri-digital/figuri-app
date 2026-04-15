export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mpClient } from '@/lib/mercadopago';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.supabase_service_role_key ||
  supabaseAnonKey;

const PRODUCT_LABELS: Record<string, string> = {
  digital: 'Figurinha Digital',
  fisica:  'Figurinha Física',
  moldura: 'Figurinha com Moldura Premium',
  pack:    'Pack de Figurinhas',
};

interface CartItem {
  id:             string;
  imageId:        string;
  variationIndex: number;
  hiresUrl:       string;
  productType:    string;
  price:          number;   // centavos
  playerName?:    string;
  country?:       string;
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticação necessário' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    // ── Payload ─────────────────────────────────────────────────────────────
    const body = await request.json();
    const items: CartItem[] = body.items;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://figuri.com.br';
    const totalCents = items.reduce((sum, i) => sum + i.price, 0);
    const totalReais = (totalCents / 100).toFixed(2);

    // ── Criar Order no Mercado Pago (API de Orders) ──────────────────────────
    const res = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `figuri-order-${user.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'automatic',
        total_amount: totalReais,
        external_reference: `figuri-${user.id}-${Date.now()}`,
        payer: { email: user.email },
        items: items.map(item => ({
          title: PRODUCT_LABELS[item.productType] || 'Figurinha Figuri',
          unit_price: (item.price / 100).toFixed(2),
          quantity: 1,
          external_reference: item.id,
        })),
        transactions: {
          payments: [{
            amount: totalReais,
            payment_method: {
              id: 'pix',
              type: 'bank_transfer',
            },
          }],
        },
        notification_url: `${siteUrl}/api/webhook`,
      }),
    });

    const order = await res.json();

    if (!res.ok) {
      console.error('MP Orders error:', order);
      throw new Error(order.message || order.error || 'Erro ao criar order no Mercado Pago');
    }

    // Extrai QR Code do primeiro pagamento
    const pixData = order.transactions?.payments?.[0]?.point_of_interaction?.transaction_data;

    if (!pixData?.qr_code) {
      throw new Error('Mercado Pago não retornou QR Code PIX');
    }

    // ── Salva order no banco (Supabase) ──────────────────────────────────────
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    await adminSupabase.from('orders').insert({
      payment_id:   String(order.id),
      user_id:      user.id,
      amount_cents: totalCents,
      status:       'pending',
      product_type: items.map(i => i.productType).join(','),
      // Armazena os itens como JSON no campo image_id (reaproveitando coluna)
      image_id:     JSON.stringify(items.map(i => ({ id: i.id, imageId: i.imageId, variationIndex: i.variationIndex, hiresUrl: i.hiresUrl }))),
    });

    return NextResponse.json({
      order_id:       String(order.id),
      qr_code:        pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
      expires_at:     new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      total_cents:    totalCents,
    });
  } catch (error: unknown) {
    console.error('Orders API error:', error);
    const message = error instanceof Error ? error.message : 'Erro ao criar pedido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
