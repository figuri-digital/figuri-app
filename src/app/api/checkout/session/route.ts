export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id é obrigatório" },
        { status: 400 }
      );
    }

    // Retrieve the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Pagamento ainda não confirmado" },
        { status: 402 }
      );
    }

    const { imageId, variationIndex } = session.metadata || {};

    if (!imageId) {
      return NextResponse.json(
        { error: "Dados da sessão incompletos" },
        { status: 400 }
      );
    }

    // Fetch the hi-res image URL from Supabase
    const { data: image, error: dbError } = await supabase
      .from("images")
      .select("id, generated_url, status, cart_status")
      .eq("id", imageId)
      .single();

    if (dbError || !image) {
      return NextResponse.json(
        { error: "Imagem não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      imageId: image.id,
      variationIndex: variationIndex ? parseInt(variationIndex) : 0,
      imageUrl: image.generated_url,
      status: image.status,
      cartStatus: image.cart_status,
    });
  } catch (error: unknown) {
    console.error("Session retrieval error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao buscar detalhes da sessão";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
