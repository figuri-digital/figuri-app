export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

export async function POST() {
  // TODO: implementar webhook de pagamento
  return NextResponse.json({ message: "Webhook endpoint" });
}
