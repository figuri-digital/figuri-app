export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const ME_TOKEN   = process.env.MELHOR_ENVIO_TOKEN;
const CEP_ORIGEM = '31710010';

// Dimensões do envelope (cm) e peso (kg) por tipo de produto
const PACKAGES: Record<string, { height: number; width: number; length: number; weight: number }> = {
  digital: { height: 0,   width: 0,      length: 0,     weight: 0     }, // sem envio físico
  fisica:  { height: 1,   width: 16.7,   length: 10.5,  weight: 0.01  }, // figurinha + envelope carta 16,7x10,5cm = 10g
  moldura: { height: 3,   width: 16.7,   length: 16.7,  weight: 0.05  }, // acrílico 30g + embalagem 20g = 50g
  pack:    { height: 3,   width: 16.7,   length: 16.7,  weight: 0.1   }, // pack com embalagem ~100g
};

export async function POST(request: NextRequest) {
  try {
    const { cep, items } = await request.json();

    const cleanCep = (cep || '').replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      return NextResponse.json({ error: 'CEP inválido' }, { status: 400 });
    }

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

    const res = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ME_TOKEN}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'Figuri/1.0 (guilherme@guilhermevitor.com)',
      },
      body: JSON.stringify({
        from:    { postal_code: CEP_ORIGEM },
        to:      { postal_code: cleanCep },
        package: pkg,
        options: { receipt: false, own_hand: false },
        services: '1,2', // 1 = PAC, 2 = SEDEX
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[shipping] Melhor Envio error:', data);
      return NextResponse.json({ error: 'Erro ao calcular frete' }, { status: 500 });
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
        price:         parseFloat(s.price),          // R$ float
        price_cents:   Math.round(parseFloat(s.price) * 100),
        delivery_time: s.delivery_time,              // dias úteis
        currency:      'BRL',
      }));

    return NextResponse.json({ options });
  } catch (error) {
    console.error('[shipping] calculate error:', error);
    return NextResponse.json({ error: 'Erro ao calcular frete' }, { status: 500 });
  }
}
