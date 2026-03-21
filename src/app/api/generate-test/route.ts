export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;

export const maxDuration = 60;

// ── Models ──

const MODELS: Record<string, string> = {
  'flux-2-pro': 'https://api.freepik.com/v1/ai/text-to-image/flux-2-pro',
  'nano-banana-pro': 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro',
  'seedream-v4-5': 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-5',
};

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
    const model = (formData.get('model') as string) || 'flux-2-pro';
    const promptVersion = (formData.get('prompt_version') as string) || 'v1';
    const style = (formData.get('style') as string) || 'sozinho';
    const name = (formData.get('name') as string) || '';
    const birth = (formData.get('birth') as string) || '';
    const height = (formData.get('height') as string) || '';
    const country = (formData.get('country') as string) || 'brasil';

    if (!file) {
      return NextResponse.json({ error: 'Envie uma foto' }, { status: 400 });
    }

    const modelUrl = MODELS[model];
    if (!modelUrl) {
      return NextResponse.json({ error: `Modelo "${model}" não suportado` }, { status: 400 });
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

    const templateRes = await fetch(templateUrl);
    if (!templateRes.ok) {
      return NextResponse.json({ error: 'Erro ao carregar template' }, { status: 500 });
    }
    const templateBuffer = Buffer.from(await templateRes.arrayBuffer());
    const templateBase64 = templateBuffer.toString('base64');

    // Build prompt based on version
    const prompt = promptVersion === 'v2'
      ? buildPromptV2(style, { name, birth, height, country })
      : buildPromptV1(style, { name, birth, height, country });

    console.log(`[TEST] Model: ${model} | Prompt: ${promptVersion} | Country: ${country}`);

    // Call Freepik API
    const freepikRes = await fetch(modelUrl, {
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
      }),
    });

    if (!freepikRes.ok) {
      const errText = await freepikRes.text();
      console.error(`[TEST] Freepik error (${model}):`, freepikRes.status, errText);
      return NextResponse.json({ error: `Freepik error: ${errText.slice(0, 300)}` }, { status: 500 });
    }

    const freepikData = await freepikRes.json();
    const taskId = freepikData.data?.task_id;

    if (!taskId) {
      return NextResponse.json({ error: 'Sem task_id na resposta' }, { status: 500 });
    }

    console.log(`[TEST] Task queued: ${taskId} (${model} / ${promptVersion})`);

    return NextResponse.json({
      success: true,
      imageId,
      taskId,
      model,
      promptVersion,
      status: 'processing',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[TEST] Generate error:', err);
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

// ── PROMPT V1 (atual) ──

function buildPromptV1(style: string, data: StickerData): string {
  const country = data.country || 'brasil';
  const jersey = COUNTRY_JERSEYS[country] || COUNTRY_JERSEYS.brasil;

  if (style === 'pet') {
    return `I have two reference images. The first is a photo of a pet/animal. The second is a FIFA World Cup 2026 player card template. Create a FIFA World Cup 2026 sticker card featuring the pet from the first image as a team mascot wearing a ${jersey}, placed in the exact card layout from the second image. Player name: "${data.name || 'MASCOTE'}". Keep all card design elements. Fun and photorealistic.`;
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

// ── PROMPT V2 (melhorado) ──

const COUNTRY_DETAILS_V2: Record<string, { jersey: string; bgDesc: string }> = {
  brasil: {
    jersey: 'official Brazil national team jersey — bright yellow (canário) shirt with green collar, green sleeve trim, and the CBF badge on the chest',
    bgDesc: 'green gradient background with layered geometric shapes',
  },
  argentina: {
    jersey: 'official Argentina national team jersey — white shirt with vertical sky blue stripes and the AFA badge on the chest',
    bgDesc: 'light blue gradient background with geometric shapes',
  },
  franca: {
    jersey: 'official France national team jersey — dark navy blue shirt with the FFF rooster badge on the chest',
    bgDesc: 'dark blue gradient background with geometric shapes',
  },
  alemanha: {
    jersey: 'official Germany national team jersey — white shirt with black, red, and gold accent details and the DFB eagle badge on the chest',
    bgDesc: 'grey/white gradient background with geometric shapes',
  },
  espanha: {
    jersey: 'official Spain national team jersey — vibrant red shirt with subtle yellow accents and the RFEF badge on the chest',
    bgDesc: 'red gradient background with geometric shapes',
  },
  portugal: {
    jersey: 'official Portugal national team jersey — deep red shirt with green collar details and the FPF shield badge on the chest',
    bgDesc: 'dark red gradient background with geometric shapes',
  },
  uruguai: {
    jersey: 'official Uruguay national team jersey — light celeste blue shirt with the AUF sun badge on the chest',
    bgDesc: 'light blue gradient background with geometric shapes',
  },
  colombia: {
    jersey: 'official Colombia national team jersey — bright yellow shirt with blue and red trim details and the FCF badge on the chest',
    bgDesc: 'yellow/gold gradient background with geometric shapes',
  },
};

function buildPromptV2(style: string, data: StickerData): string {
  const country = data.country || 'brasil';
  const details = COUNTRY_DETAILS_V2[country] || COUNTRY_DETAILS_V2.brasil;

  if (style === 'pet') {
    return `I have two reference images:
- IMAGE 1: A photo of a pet/animal.
- IMAGE 2: A FIFA World Cup 2026 player card template.

Create a fun, photorealistic FIFA World Cup 2026 sticker card:
1. Feature the exact pet/animal from IMAGE 1 as a team mascot, wearing a ${details.jersey}
2. Replicate the EXACT card layout from IMAGE 2 — every badge, icon, background element, panel, and decoration must be identical
3. Do NOT redesign or reinterpret any card element from IMAGE 2
4. The pet should look adorable and proud, centered, facing camera

Player info — Name: "${data.name || 'MASCOTE'}"

Ultra high quality, sharp details, vibrant colors, no artifacts.`;
  }

  if (style === 'grupo') {
    return `I have two reference images:
- IMAGE 1: A group photo of real people.
- IMAGE 2: A FIFA World Cup 2026 player card template.

Create a photorealistic FIFA World Cup 2026 sticker card:
1. Feature the group from IMAGE 1 with their EXACT faces and appearances preserved
2. All wearing ${details.jersey}
3. Replicate the EXACT card layout from IMAGE 2 — every badge, icon, background, panel must be identical
4. Do NOT redesign or reinterpret any card element

Player info — Name: "${data.name || 'FAMÍLIA'}"

Ultra high quality, sharp details, no artifacts.`;
  }

  return `I have two reference images:
- IMAGE 1: A photo of a real person. This is the ONLY face reference. Preserve their EXACT face, every facial feature, skin tone, hair color, hair style, and overall appearance with absolutely zero alterations.
- IMAGE 2: A FIFA World Cup 2026 player card template. This is the ONLY layout reference. Replicate this design EXACTLY as-is — do NOT redesign, reinterpret, add, remove, or modify any visual element.

Generate a photorealistic FIFA World Cup 2026 sticker card following these strict rules:

FACE (from IMAGE 1):
- The person's face must be a perfect, unmistakable likeness of the person in IMAGE 1
- Preserve exact eye shape, nose, mouth, jawline, eyebrows, skin texture, and complexion
- Natural, confident expression with a slight smile, looking directly at camera
- Studio-quality lighting on the face that matches the card's overall lighting

BODY & CLOTHING:
- Show the person from chest up, perfectly centered in the card frame
- Wearing the ${details.jersey}
- Natural body proportions consistent with the person's face

CARD LAYOUT (from IMAGE 2):
- Copy every single design element from IMAGE 2 pixel-perfectly: ${details.bgDesc}, FIFA World Cup trophy icon, country badge, large number, bottom rounded info panel, stylized "26" logo, and all decorative elements
- Do NOT change background colors, do NOT add extra elements, do NOT modify borders or badges
- Seamlessly blend the person into the card with matching color temperature and shadows

PLAYER INFO:
- Name: "${data.name || 'JOGADOR'}"
- Height: "M ${data.height || '1,75'}"
- Date of birth: "${data.birth || '1-1-2000'}"

Ultra high quality, razor-sharp details, vibrant colors, no artifacts, no blur, no distortion. Professional sports card production quality.`;
}
