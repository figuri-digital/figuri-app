import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Stripe instance created on-demand for webhook signature verification
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // TODO: Add signature verification when STRIPE_WEBHOOK_SECRET is configured
    // const sig = request.headers.get('stripe-signature')!;
    // const event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    const event = JSON.parse(body) as Stripe.Event;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { imageId, variationIndex, userId } = session.metadata || {};

      if (!imageId) {
        console.error("Webhook: missing imageId in metadata");
        return NextResponse.json(
          { error: "Missing imageId" },
          { status: 400 }
        );
      }

      console.log(
        `Payment completed for image ${imageId}, variation ${variationIndex}, user ${userId}`
      );

      // Update the image record to mark as paid
      const { error: updateError } = await supabase
        .from("images")
        .update({
          status: "paid",
          cart_status: "purchased",
        })
        .eq("id", imageId);

      if (updateError) {
        console.error("Error updating image after payment:", updateError);
        return NextResponse.json(
          { error: "Failed to update image" },
          { status: 500 }
        );
      }

      console.log(`Image ${imageId} marked as paid successfully`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
