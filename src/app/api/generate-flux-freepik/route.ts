import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;

export const maxDuration = 60;

const FREEPIK_FLUX_URL = 'https://api.freepik.com/v1/ai/text-to-image/flux-2-pro';

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
    if (!templateRes.ok) {
      console.error('Template fetch failed:', templateRes.status);
      return NextResponse.json({ error: 'Erro ao carregar template' }, { status: 500 });
    }
    const templateBuffer = Buffer.from(await templateRes.arrayBuffer());
    const templateBase64 = templateBuffer.toString('base64');

    // Build prompt
    const prompt = buildPrompt(style, { name, birth, height, country });

    console.log('Calling Flux 2 Pro via Freepik...', country, style);

    // Call Freepik Flux 2 Pro API
    const freepikRes = await fetch(FREEPIK_FLUX_URL, {
      method: 'POST',
      headers: {
        'x-freepik-api-key': FREEPIK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        input_image: userPhotoBase64,
        input_image_2: templateBase64,
        width: 768,
        height: 1024,
        prompt_upsampling: false,
      }),
    });

    if (!freepikRes.ok) {
      const errText = await freepikRes.text();
      console.error('Freepik Flux error:', freepikRes.status, errText);
      return NextResponse.json({ error: `Freepik API error: ${errText.slice(0, 300)}` }, { status: 500 });
    }

    const freepikData = await freepikRes.json();
    console.log('Freepik Flux response:', JSON.stringify(freepikData).slice(0, 300));

    const taskId = freepikData.data?.task_id;

    if (!taskId) {
      console.error('No task_id from Freepik:', JSON.stringify(freepikData).slice(0, 500));
      return NextResponse.json({ error: 'Erro na fila de geração' }, { status: 500 });
    }

    console.log('Freepik Flux task queued:', taskId);

    return NextResponse.json({
      success: true,
      imageId,
      userId: user.id,
      taskId,
      status: 'processing',
      engine: 'flux-freepik',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Flux Freepik generate error:', err);
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

  const COUNTRY_JERSEYS: Record<string, string> = {
    brasil: 'Brazil national team jersey (yellow shirt with green details)',
    argentina: 'Argentina national team jersey (white and sky blue stripes)',
    franca: 'France national team jersey (dark blue)',
    alemanha: 'Germany national team jersey (white with black, red, yellow details)',
    espanha: 'Spain national team jersey (red with yellow accents)',
    portugal: 'Portugal national team jersey (red with green details)',
    uruguai: 'Uruguay national team jersey (light blue)',
    colombia: 'Colombia national team jersey (yellow with blue/red details)',
  };

  const jersey = COUNTRY_JERSEYS[country] || COUNTRY_JERSEYS.brasil;

  if (style === 'pet') {
    return `I have two reference images. The first is a photo of a pet/animal. The second is a FIFA World Cup 2026 player card template. Create a FIFA World Cup 2026 sticker card featuring the pet from the first image as a team mascot wearing a ${jersey}, placed in the exact card layout from the second image. Player name: "${data.name || 'MASCOTE'}", Height: "M ${data.height || '0,50'}", Birth: "${data.birth || '1-1-2020'}". Keep all card design elements. Fun and photorealistic.`;
  }

  if (style === 'grupo') {
    return `I have two reference images. The first is a group photo. The second is a FIFA World Cup 2026 player card template. Create a FIFA World Cup 2026 sticker card featuring the group from the first image wearing ${jersey}, placed in the exact card layout from the second image. Name: "${data.name || 'FAMÍLIA'}". Keep all card design elements. Photorealistic.`;
  }

  return `I have two reference images. The first image is a photo of a real person — use their EXACT face, features, skin tone, and appearance. The second image is a FIFA World Cup 2026 player card template — use its EXACT layout, design, colors, badges, background, FIFA trophy icon, number "2", and bottom panel.

Create a new FIFA World Cup 2026 sticker card that:
1. Features the person from the first image with their EXACT face preserved
2. Shows them wearing a ${jersey}, cropped from chest up, centered
3. Follows the EXACT card layout and design from the second image
4. Displays player name: "${data.name || 'JOGADOR'}"
5. Shows height: "M ${data.height || '1,75'}"
6. Shows date of birth: "${data.birth || '1-1-2000'}"

The face MUST be identical to the person in the first reference image. Professional sports card quality, photorealistic lighting.`;
}
