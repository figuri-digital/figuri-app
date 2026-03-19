import { NextResponse } from "next/server";

export async function POST() {
  // TODO: implementar lógica de geração de figurinha
  return NextResponse.json({ message: "Generate endpoint" });
}
