export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Authenticate user via Supabase token
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Token de autenticação necessário" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { imageId, variationIndex } = body;

    if (!imageId || variationIndex === undefined || variationIndex === null) {
      return NextResponse.json(
        { error: "imageId e variationIndex são obrigatórios" },
        { status: 400 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://figuri.com.br";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: "Figurinha FIGURI IA",
              description:
                "Sua figurinha personalizada em alta resolução, sem marca d'água",
            },
            unit_amount: 1990, // R$19,90
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${siteUrl}/compra-sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/gerar.html`,
      metadata: {
        imageId: String(imageId),
        variationIndex: String(variationIndex),
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Checkout error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao criar sessão de pagamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
