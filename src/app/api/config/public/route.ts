export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * GET /api/config/public
 * Retorna variáveis de ambiente públicas para arquivos HTML estáticos.
 * Nunca expor chaves secretas aqui.
 */
export async function GET() {
  return NextResponse.json(
    {
      mpPublicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || '',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
