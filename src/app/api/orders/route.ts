export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const totalReais = totalCents / 100;

    // Descrição resumida dos itens
    const description = items.length === 1
      ? (PRODUCT_LABELS[items[0].productType] || 'Figurinha Figuri')
      : `Figuri – ${items.length} itens`;

    // ── Verificação prévia das credenciais ──────────────────────────────────
    if (!process.env.MP_ACCESS_TOKEN) {
      console.error('[orders] MP_ACCESS_TOKEN não configurado nas variáveis de ambiente');
      return NextResponse.json({ error: 'Pagamento temporariamente indisponível. Contate o suporte.' }, { status: 503 });
    }

    // ── Criar pagamento PIX via API clássica de Payments ────────────────────
    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `figuri-pix-${user.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: totalReais,
        description,
        payment_method_id: 'pix',
        external_reference: `figuri-${user.id}-${Date.now()}`,
        payer: { email: user.email },
        notification_url: `${siteUrl}/api/webhook`,
      }),
    });

    const payment = await res.json();

    if (!res.ok) {
      console.error('MP Payments (PIX) error:', payment);
      throw new Error(
        payment.message ||
        (payment.cause?.[0]?.description) ||
        'Erro ao criar pagamento PIX'
      );
    }

    // Extrai QR Code
    const pixData = payment.point_of_interaction?.transaction_data;
    if (!pixData?.qr_code) {
      throw new Error('Mercado Pago não retornou QR Code PIX');
    }

    // ── Salva pedido no banco (Supabase) ─────────────────────────────────────
    try {
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error: dbError } = await adminSupabase.from('orders').insert({
        payment_id:   String(payment.id),
        user_id:      user.id,
        amount_cents: totalCents,
        status:       'pending',
        product_type: items.map(i => i.productType).join(','),
        image_id:     JSON.stringify(items.map(i => ({
          id: i.id,
          imageId: i.imageId,
          variationIndex: i.variationIndex,
          hiresUrl: i.hiresUrl,
        }))),
      });
      if (dbError) {
        console.error('[orders] Supabase insert error (non-fatal):', dbError.message);
      }
    } catch (dbEx) {
      console.error('[orders] Supabase insert exception (non-fatal):', dbEx);
    }

    return NextResponse.json({
      order_id:       String(payment.id),
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
