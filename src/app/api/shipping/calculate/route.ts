export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const ME_TOKEN   = process.env.MELHOR_ENVIO_TOKEN;
const CEP_ORIGEM = '31710010';

// Dimensões (cm, inteiros) e peso (kg) por tipo de produto
// Correios exigem dimensões inteiras e peso mínimo de 0.1kg
const PACKAGES: Record<string, { height: number; width: number; length: number; weight: number }> = {
  digital: { height: 1,  width: 11,  length: 17,  weight: 0.1  }, // fallback (não deve chegar aqui)
  fisica:  { height: 1,  width: 11,  length: 17,  weight: 0.1  }, // envelope carta 16,7x10,5 → arredondado 17x11cm, mín. 100g
  moldura: { height: 3,  width: 17,  length: 17,  weight: 0.1  }, // caixa acrílico, mín. 100g
  pack:    { height: 3,  width: 17,  length: 17,  weight: 0.2  }, // pack, ~200g
};

export async function POST(request: NextRequest) {
  try {
    const { cep, items } = await request.json();

    const cleanCep = (cep || '').replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      return NextResponse.json({ error: 'CEP inválido' }, { status: 400 });
    }
    // Melhor Envio espera formato XXXXX-XXX
    const formattedCep = `${cleanCep.slice(0,5)}-${cleanCep.slice(5)}`;
    const formattedOrigin = `${CEP_ORIGEM.slice(0,5)}-${CEP_ORIGEM.slice(5)}`;

    // Verifica se há algum produto físico
    interface ShipItem { productType: string }
    const hasPhysical = (items as ShipItem[] || []).some(
      (i) => i.productType !== 'digital'
    );
    if (!hasPhysical) {
      return NextResponse.json({ options: [], digital_only: true });
    }

    if (!ME_TOKEN) {
      console.error('[shipping] MELHOR_ENVIO_TOKEN não configurado');
      return NextResponse.json({ error: 'Serviço de frete não configurado' }, { status: 503 });
    }

    // Usa o pacote do item mais pesado do carrinho
    let pkg = PACKAGES.fisica;
    for (const item of (items || [])) {
      const p = PACKAGES[item.productType];
      if (p && p.weight > pkg.weight) pkg = p;
    }

    const reqBody = {
      from:    { postal_code: formattedOrigin },
      to:      { postal_code: formattedCep },
      package: pkg,
      options: { receipt: false, own_hand: false },
      services: '1,2',
    };
    console.log('[shipping] ME request:', JSON.stringify(reqBody));

    const res = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ME_TOKEN}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'Figuri/1.0 (guilherme@guilhermevitor.com)',
      },
      body: JSON.stringify({
        ...reqBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[shipping] ME status:', res.status, JSON.stringify(data));
      const detail = data?.errors
        ? JSON.stringify(data.errors)
        : (data?.message || JSON.stringify(data));
      return NextResponse.json({ error: `[HTTP ${res.status}] ${detail}` }, { status: 500 });
    }

    interface MEService {
      id: number;
      name: string;
      company?: { name?: string };
      price?: string;
      delivery_time?: number;
      error?: string;
    }

    const options = (Array.isArray(data) ? (data as MEService[]) : [])
      .filter((s) => !s.error && s.price)
      .map((s) => ({
        id:            s.id,
        name:          s.name,
        company:       s.company?.name || '',
        price:         parseFloat(s.price ?? '0'),
        price_cents:   Math.round(parseFloat(s.price ?? '0') * 100),
        delivery_time: s.delivery_time,              // dias úteis
        currency:      'BRL',
      }));

    return NextResponse.json({ options });
  } catch (error) {
    console.error('[shipping] calculate error:', error);
    return NextResponse.json({ error: 'Erro ao calcular frete' }, { status: 500 });
  }
}
