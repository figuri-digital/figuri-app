export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Payment } from 'mercadopago';
import { mpClient } from '@/lib/mercadopago';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.supabase_service_role_key ||
  supabaseAnonKey;

interface CartItem {
  id: string;
  price: number;
  productType: string;
  playerName?: string;
  imageId?: string;
  variationIndex?: number;
  hiresUrl?: string;
}

interface CardPayload {
  token: string;
  issuer_id: string;
  payment_method_id: string;
  transaction_amount: number;
  installments: number;
  payer: {
    email: string;
    identification: { type: string; number: string };
  };
  items: CartItem[];
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
    const body: CardPayload = await request.json();

    if (!body.token || !body.payment_method_id || !body.transaction_amount) {
      return NextResponse.json({ error: 'Dados do cartão incompletos' }, { status: 400 });
    }

    // ── Criar pagamento via MP Payments API ──────────────────────────────────
    const paymentClient = new Payment(mpClient);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://figuri.com.br';

    const payment = await paymentClient.create({
      body: {
        transaction_amount: body.transaction_amount,
        token:              body.token,
        description:        `Figuri — ${body.items.length} figurinha(s)`,
        installments:       body.installments || 1,
        payment_method_id:  body.payment_method_id,
        issuer_id:          body.issuer_id ? parseInt(body.issuer_id) : undefined,
        payer: {
          email:          body.payer.email,
          identification: {
            type:   body.payer.identification.type,
            number: body.payer.identification.number,
          },
        },
        notification_url: `${siteUrl}/api/webhook`,
        metadata: {
          user_id:   user.id,
          item_ids:  body.items.map(i => i.id).join(','),
        },
      },
    });

    // ── Salvar pedido no banco ───────────────────────────────────────────────
    if (payment.status === 'approved' || payment.status === 'in_process') {
      try {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
        const { error: dbError } = await adminSupabase.from('orders').insert({
          payment_id:   String(payment.id),
          user_id:      user.id,
          amount_cents: Math.round(body.transaction_amount * 100),
          status:       payment.status === 'approved' ? 'paid' : 'pending',
          product_type: body.items.map(i => i.productType).join(','),
          image_id:     JSON.stringify(
            body.items.map(i => ({ id: i.id, imageId: i.imageId, variationIndex: i.variationIndex, hiresUrl: i.hiresUrl }))
          ),
          paid_at: payment.status === 'approved' ? new Date().toISOString() : null,
        });
        if (dbError) {
          console.error('[card] Supabase insert error (non-fatal):', dbError.message);
        }
      } catch (dbEx) {
        console.error('[card] Supabase insert exception (non-fatal):', dbEx);
      }
    }

    return NextResponse.json({
      status:        payment.status,         // approved | in_process | rejected
      status_detail: payment.status_detail,
      payment_id:    String(payment.id),
    });
  } catch (error: unknown) {
    console.error('Card payment error:', error);
    const message = error instanceof Error ? error.message : 'Erro no pagamento com cartão';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
