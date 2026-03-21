export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { applyWatermark } from '@/lib/watermark';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

export const maxDuration = 60;

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('photo') as File | null;
    const style = (formData.get('style') as string) || 'sozinho';
    const name = (formData.get('name') as string) || '';
    const birth = (formData.get('birth') as string) || '';
    const height = (formData.get('height') as string) || '';
    const country = (formData.get('country') as string) || 'brasil';

    if (!file) {
      return NextResponse.json({ error: 'Envie uma foto' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const userPhotoBuffer = Buffer.from(bytes);
    const userPhotoBase64 = userPhotoBuffer.toString('base64');
    const imageId = uuidv4();

    // Upload original to Supabase Storage
    const originalPath = `originals/${user.id}/${imageId}.jpg`;
    await supabase.storage.from('images').upload(originalPath, userPhotoBuffer, {
      contentType: file.type || 'image/jpeg',
    });

    // Load template image as base64
    const host = req.headers.get('host') || 'figuri-app.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const templateFile = COUNTRY_TEMPLATES[country] || COUNTRY_TEMPLATES.brasil;
    const templateUrl = `${protocol}://${host}/templates/${templateFile}`;

    console.log('Loading template:', templateUrl);
    const templateRes = await fetch(templateUrl);
    const templateBuffer = Buffer.from(await templateRes.arrayBuffer());
    const templateBase64 = templateBuffer.toString('base64');

    // Build prompt
    const prompt = buildPrompt(style, { name, birth, height, country });

    console.log('Calling Gemini Nano Banana...', GEMINI_MODEL);

    // Call Gemini API (synchronous — returns image directly)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: userPhotoBase64,
                },
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: templateBase64,
                },
              },
            ],
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: '3:4',
              imageSize: '2K',
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);
      return NextResponse.json({ error: `Gemini API error: ${errText.slice(0, 300)}` }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    console.log('Gemini response keys:', Object.keys(geminiData));

    // Extract generated image from response
    const candidates = geminiData.candidates;
    if (!candidates?.length) {
      console.error('No candidates in Gemini response:', JSON.stringify(geminiData).slice(0, 500));
      return NextResponse.json({ error: 'Nenhuma imagem gerada pelo Gemini' }, { status: 500 });
    }

    const parts = candidates[0].content?.parts || [];
    let generatedBase64: string | null = null;

    for (const part of parts) {
      if (part.inline_data?.data) {
        generatedBase64 = part.inline_data.data;
        break;
      }
    }

    if (!generatedBase64) {
      console.error('No image in Gemini response parts:', JSON.stringify(parts.map((p: Record<string, unknown>) => Object.keys(p))));
      return NextResponse.json({ error: 'Gemini não retornou imagem' }, { status: 500 });
    }

    const genBuffer = Buffer.from(generatedBase64, 'base64');

    // Upload hi-res
    const hiresPath = `generated/${user.id}/${imageId}-nano.jpg`;
    await supabase.storage.from('images').upload(hiresPath, genBuffer, {
      contentType: 'image/jpeg',
    });
    const { data: hiresUrlData } = supabase.storage.from('images').getPublicUrl(hiresPath);

    // Apply watermark
    const watermarkedBuffer = await applyWatermark(genBuffer);

    // Upload preview
    const previewPath = `previews/${user.id}/${imageId}-nano.jpg`;
    await supabase.storage.from('images').upload(previewPath, watermarkedBuffer, {
      contentType: 'image/jpeg',
    });
    const { data: previewUrlData } = supabase.storage.from('images').getPublicUrl(previewPath);

    console.log('Nano Banana generation complete!', imageId);

    return NextResponse.json({
      success: true,
      imageId,
      previewUrl: previewUrlData.publicUrl,
      hiresUrl: hiresUrlData.publicUrl,
      engine: 'nano-banana',
      status: 'completed',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Nano Banana generate error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Templates ──

const COUNTRY_TEMPLATES: Record<string, string> = {
  brasil: 'brasil.jpg',
  argentina: 'argentina.jpg',
  franca: 'franca.jpg',
  alemanha: 'alemanha.jpg',
  espanha: 'espanha.jpg',
  portugal: 'portugal.jpg',
  uruguai: 'uruguai.jpg',
  colombia: 'colombia.jpg',
};

// ── Prompts ──

interface StickerData {
  name?: string;
  birth?: string;
  height?: string;
  country?: string;
}

function buildPrompt(style: string, data: StickerData): string {
  const country = data.country || 'brasil';
  const prompts: Record<string, string> = {
    brasil: `I'm providing two images. The first image is a photo of a real person. The second image is a FIFA World Cup 2026 Brazil player card template.

Create a new image that:
1. Uses the EXACT face, features, and appearance of the person from the FIRST image
2. Follows the EXACT layout, design, colors, and composition of the SECOND image (the Brazil card template)
3. Places the person wearing a Brazil national team jersey (yellow with green details)
4. Replaces the player name with "${data.name || 'JOGADOR'}"
5. Replaces height with "M ${data.height || '1,75'}"
6. Replaces date of birth with "${data.birth || '1-1-2000'}"

The face MUST be identical to the person in the first photo. Keep all card design elements (FIFA trophy, Brazil badge, number 2, green background, "26" logo) exactly as shown in the template. Photorealistic quality.`,

    argentina: `I'm providing two images. The first is a photo of a real person. The second is a FIFA World Cup 2026 Argentina player card template.
Create a new image using the EXACT face from the FIRST image, placed into the EXACT layout of the SECOND image. The person wears an Argentina jersey (white and sky blue stripes).
Player name: "${data.name || 'JOGADOR'}", Height: "M ${data.height || '1,75'}", Birth: "${data.birth || '1-1-2000'}".
Face MUST match the first photo exactly. Keep all card elements. Photorealistic.`,

    franca: `I'm providing two images. The first is a photo of a real person. The second is a FIFA World Cup 2026 France player card template.
Create a new image using the EXACT face from the FIRST image, placed into the EXACT layout of the SECOND image. The person wears a France jersey (dark blue).
Player name: "${data.name || 'JOGADOR'}", Height: "M ${data.height || '1,75'}", Birth: "${data.birth || '1-1-2000'}".
Face MUST match the first photo exactly. Keep all card elements. Photorealistic.`,

    alemanha: `I'm providing two images. The first is a photo of a real person. The second is a FIFA World Cup 2026 Germany player card template.
Create a new image using the EXACT face from the FIRST image, placed into the EXACT layout of the SECOND image. The person wears a Germany jersey (white with black/red/yellow details).
Player name: "${data.name || 'JOGADOR'}", Height: "M ${data.height || '1,75'}", Birth: "${data.birth || '1-1-2000'}".
Face MUST match the first photo exactly. Keep all card elements. Photorealistic.`,

    espanha: `I'm providing two images. The first is a photo of a real person. The second is a FIFA World Cup 2026 Spain player card template.
Create a new image using the EXACT face from the FIRST image, placed into the EXACT layout of the SECOND image. The person wears a Spain jersey (red with yellow accents).
Player name: "${data.name || 'JOGADOR'}", Height: "M ${data.height || '1,75'}", Birth: "${data.birth || '1-1-2000'}".
Face MUST match the first photo exactly. Keep all card elements. Photorealistic.`,

    portugal: `I'm providing two images. The first is a photo of a real person. The second is a FIFA World Cup 2026 Portugal player card template.
Create a new image using the EXACT face from the FIRST image, placed into the EXACT layout of the SECOND image. The person wears a Portugal jersey (red with green details).
Player name: "${data.name || 'JOGADOR'}", Height: "M ${data.height || '1,75'}", Birth: "${data.birth || '1-1-2000'}".
Face MUST match the first photo exactly. Keep all card elements. Photorealistic.`,

    uruguai: `I'm providing two images. The first is a photo of a real person. The second is a FIFA World Cup 2026 Uruguay player card template.
Create a new image using the EXACT face from the FIRST image, placed into the EXACT layout of the SECOND image. The person wears a Uruguay jersey (light blue).
Player name: "${data.name || 'JOGADOR'}", Height: "M ${data.height || '1,75'}", Birth: "${data.birth || '1-1-2000'}".
Face MUST match the first photo exactly. Keep all card elements. Photorealistic.`,

    colombia: `I'm providing two images. The first is a photo of a real person. The second is a FIFA World Cup 2026 Colombia player card template.
Create a new image using the EXACT face from the FIRST image, placed into the EXACT layout of the SECOND image. The person wears a Colombia jersey (yellow with blue/red details).
Player name: "${data.name || 'JOGADOR'}", Height: "M ${data.height || '1,75'}", Birth: "${data.birth || '1-1-2000'}".
Face MUST match the first photo exactly. Keep all card elements. Photorealistic.`,
  };

  if (style === 'pet') {
    return `I'm providing two images. The first is a photo of an animal/pet. The second is a FIFA World Cup 2026 player card template. Create a new image placing the pet from the first image into the card layout, dressed as a team mascot. Name: "${data.name || 'MASCOTE'}". Keep all card elements. Fun and photorealistic.`;
  }

  if (style === 'grupo') {
    return `I'm providing two images. The first is a group photo. The second is a FIFA World Cup 2026 player card template. Create a new image placing the group from the first image into the card layout, all wearing national team jerseys. Name: "${data.name || 'FAMÍLIA'}". Keep all card elements. Photorealistic.`;
  }

  return prompts[country] || prompts.brasil;
}
