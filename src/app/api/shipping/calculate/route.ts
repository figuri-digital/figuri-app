export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const ME_TOKEN   = process.env.MELHOR_ENVIO_TOKEN;
const CEP_ORIGEM = '31710010';

const PACKAGES: Record<string, { height: number; width: number; length: number; weight: number }> = {
  digital: { height: 1, width: 11, length: 17, weight: 0.3 },
  fisica:  { height: 1, width: 11, length: 17, weight: 0.3 },
  moldura: { height: 3, width: 17, length: 17, weight: 0.3 },
  pack:    { height: 3, width: 17, length: 17, weight: 0.3 },
};

export async function POST(request: NextRequest) {
  try {
    const { cep, items } = await request.json();

    const cleanCep = (cep || '').replace(/\D/g, '').trim();
    if (cleanCep.length !== 8) {
      return NextResponse.json({ error: 'CEP inválido' }, { status: 400 });
    }

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

    let pkg = PACKAGES.fisica;
    for (const item of (items || [])) {
      const p = PACKAGES[(item as ShipItem).productType];
      if (p && p.weight > pkg.weight) pkg = p;
    }

    // Testa ambos os formatos — sem hífen (formato mais comum na API ME)
    const reqBody = {
      from:    { postal_code: CEP_ORIGEM },
      to:      { postal_code: cleanCep },
      package: {
        height: pkg.height,
        width:  pkg.width,
        length: pkg.length,
        weight: pkg.weight,
      },
      options: {
        receipt:  false,
        own_hand: false,
      },
    };

    const res = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ME_TOKEN}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'Figuri/1.0 guilherme@guilhermevitor.com',
      },
      body: JSON.stringify(reqBody),
    });

    const data = await res.json();

    if (!res.ok) {
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

    const all = (Array.isArray(data) ? (data as MEService[]) : [])
      .filter((s) => !s.error && s.price)
      .map((s) => ({
        id:            s.id,
        name:          s.name,
        company:       s.company?.name || '',
        price:         parseFloat(s.price ?? '0'),
        price_cents:   Math.round(parseFloat(s.price ?? '0') * 100),
        delivery_time: s.delivery_time,
        currency:      'BRL',
      }))
      .sort((a, b) => a.price - b.price);

    // Correios PAC, SEDEX e Mini Envios
    const correios = all.filter((s) =>
      s.company.toLowerCase().includes('correios')
    );

    // Loggi Express apenas
    const loggiExpress = all.filter((s) =>
      s.company.toLowerCase().includes('loggi') &&
      s.name.toLowerCase().includes('express')
    ).slice(0, 1);

    // Carta Registrada só aparece se NÃO houver moldura no pedido
    // (moldura tem peso que inviabiliza carta registrada)
    const hasMoldura = (items as ShipItem[] || []).some(
      (i) => i.productType === 'moldura'
    );

    const cartaRegistrada = hasMoldura ? [] : [{
      id:            9999,
      name:          'Carta Registrada',
      company:       'Correios',
      price:         0,
      price_cents:   0,
      delivery_time: 15,
      currency:      'BRL',
    }];

    const options = [...correios, ...loggiExpress, ...cartaRegistrada]
      .sort((a, b) => a.price - b.price);

    return NextResponse.json({ options });
  } catch (error) {
    console.error('[shipping] calculate error:', error);
    return NextResponse.json({ error: 'Erro ao calcular frete' }, { status: 500 });
  }
}
