import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;

export const maxDuration = 60;

const FREEPIK_FLUX_URL = 'https://api.freepik.com/v1/ai/text-to-image/flux-2-pro';
const NUM_VARIATIONS = 3;

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

    // Check/create credits
    let { data: credits } = await supabase
      .from('usage_credits')
      .select('credits_used, credits_limit')
      .eq('user_id', user.id)
      .single();

    if (!credits) {
      await supabase.from('usage_credits').insert({
        user_id: user.id,
        credits_used: 0,
        credits_limit: 5,
      });
      credits = { credits_used: 0, credits_limit: 5 };
    }

    if (credits.credits_used >= credits.credits_limit) {
      return NextResponse.json({
        error: 'Você usou todos os previews gratuitos.',
      }, { status: 403 });
    }

    // Ensure profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      await supabase.from('profiles').insert({
        id: user.id,
        name: user.user_metadata?.full_name || user.email || '',
      });
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
    const buffer = Buffer.from(bytes);
    const userPhotoBase64 = buffer.toString('base64');
    const imageId = uuidv4();

    // Upload original to Supabase Storage
    const originalPath = `originals/${user.id}/${imageId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(originalPath, buffer, { contentType: file.type || 'image/jpeg' });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Erro ao salvar foto' }, { status: 500 });
    }

    const { data: originalUrlData } = supabase.storage
      .from('images')
      .getPublicUrl(originalPath);

    // Load template as base64
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

    // Build prompt
    const prompt = buildPrompt(style, { name, birth, height, country });

    // Create image record
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('images').insert({
      id: imageId,
      user_id: user.id,
      original_url: originalUrlData.publicUrl,
      generated_url: '',
      watermark_url: '',
      style,
      prompt,
      status: 'processing',
      expires_at: expiresAt,
      cart_status: 'preview',
    });

    // Submit 3 generation tasks to Freepik Flux 2 Pro in parallel
    console.log(`Submitting ${NUM_VARIATIONS} Flux 2 Pro tasks via Freepik...`);
    console.log('Country:', country, '| Style:', style);

    const taskPromises = Array.from({ length: NUM_VARIATIONS }, () =>
      fetch(FREEPIK_FLUX_URL, {
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
      })
    );

    const responses = await Promise.all(taskPromises);
    const taskIds: string[] = [];

    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      if (!res.ok) {
        const errText = await res.text();
        console.error(`Freepik task ${i + 1} error:`, res.status, errText);
        continue;
      }
      const data = await res.json();
      const tid = data.data?.task_id;
      if (tid) {
        taskIds.push(tid);
        console.log(`Task ${i + 1} queued:`, tid);
      }
    }

    if (taskIds.length === 0) {
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      return NextResponse.json({ error: 'Nenhuma geração iniciada' }, { status: 500 });
    }

    console.log(`${taskIds.length} tasks queued for imageId ${imageId}`);

    return NextResponse.json({
      success: true,
      imageId,
      userId: user.id,
      taskIds,
      status: 'processing',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Generate error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Country templates ──

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

// ── Prompts (V1) ──

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

function buildPrompt(style: string, data: StickerData): string {
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
