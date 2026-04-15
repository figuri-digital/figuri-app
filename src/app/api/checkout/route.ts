export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Payment } from 'mercadopago';
import { mpClient } from '@/lib/mercadopago';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Preços por produto (em centavos BRL)
const PRODUCTS: Record<string, { label: string; price: number }> = {
  digital: { label: 'Figurinha Digital',              price: 1990 },
  fisica:  { label: 'Figurinha Física',               price: 2490 },
  moldura: { label: 'Figurinha com Moldura Premium',  price: 4990 },
  pack:    { label: 'Pack de Figurinhas',              price: 6990 },
};

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
    const { imageId, variationIndex, productType = 'digital' } = body;

    if (!imageId || variationIndex === undefined) {
      return NextResponse.json({ error: 'imageId e variationIndex são obrigatórios' }, { status: 400 });
    }

    const product = PRODUCTS[productType] ?? PRODUCTS.digital;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://figuri.com.br';

    // ── Criar pagamento PIX no Mercado Pago ──────────────────────────────────
    const paymentClient = new Payment(mpClient);

    const payment = await paymentClient.create({
      body: {
        transaction_amount: product.price / 100,   // valor em reais
        description: product.label,
        payment_method_id: 'pix',
        payer: {
          email: user.email!,
        },
        notification_url: `${siteUrl}/api/webhook`,
        metadata: {
          imageId: String(imageId),
          variationIndex: String(variationIndex),
          userId: user.id,
          productType,
        },
        // Expira em 30 minutos
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });

    const pixData = payment.point_of_interaction?.transaction_data;

    if (!pixData?.qr_code) {
      throw new Error('Mercado Pago não retornou dados do PIX');
    }

    return NextResponse.json({
      payment_id:     String(payment.id),
      qr_code:        pixData.qr_code,          // código para copiar e colar
      qr_code_base64: pixData.qr_code_base64,   // imagem PNG do QR Code (base64)
      expires_at:     payment.date_of_expiration,
      amount:         product.price,            // em centavos
      label:          product.label,
    });
  } catch (error: unknown) {
    console.error('Checkout PIX error:', error);
    const message = error instanceof Error ? error.message : 'Erro ao criar pagamento PIX';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
