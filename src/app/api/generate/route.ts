import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FAL_KEY = process.env.FAL_KEY!;

export const maxDuration = 60;

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

    // Get template URL
    const host = req.headers.get('host') || 'figuri-app.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const templateFile = COUNTRY_TEMPLATES[country] || COUNTRY_TEMPLATES.brasil;
    const templateUrl = `${protocol}://${host}/templates/${templateFile}`;

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

    // Call Flux 2 Pro via fal.ai (async queue)
    console.log('Calling Flux 2 Pro via fal.ai...');
    console.log('User photo:', originalUrlData.publicUrl);
    console.log('Template:', templateUrl);
    console.log('Country:', country, '| Style:', style);

    const falRes = await fetch('https://queue.fal.run/fal-ai/flux-2-pro/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_urls: [
          originalUrlData.publicUrl,  // @image1 = user's face
          templateUrl,                // @image2 = country template
        ],
        image_size: 'portrait_4_3',
        output_format: 'jpeg',
        safety_tolerance: '3',
        enable_safety_checker: true,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      console.error('fal.ai error:', falRes.status, errText);
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      return NextResponse.json({ error: `Erro na geração: ${errText}` }, { status: 500 });
    }

    const falData = await falRes.json();
    console.log('fal.ai queue response:', JSON.stringify(falData).slice(0, 300));

    const requestId = falData.request_id;

    if (!requestId) {
      console.error('No request_id from fal.ai:', JSON.stringify(falData).slice(0, 500));
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      return NextResponse.json({ error: 'Erro na fila de geração' }, { status: 500 });
    }

    console.log('fal.ai task queued:', requestId);

    return NextResponse.json({
      success: true,
      imageId,
      userId: user.id,
      taskId: requestId,
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

// ── Prompts ──

interface StickerData {
  name?: string;
  birth?: string;
  height?: string;
  country?: string;
}

const COUNTRY_PROMPTS: Record<string, (d: StickerData) => string> = {
  brasil: (d) => `Use the face and appearance of the person in @image1. Place them into the exact layout, composition, and design of @image2 (a FIFA World Cup 2026 player card for Brazil).
Keep ALL design elements from @image2 exactly the same: green background with layered shapes, FIFA World Cup trophy icon on the left, Brazil 2026 badge on the top right, large white number "2" in the background, bottom rounded white panel, green stylized "26" on the bottom right.
The person from @image1 must be wearing a Brazil national team jersey (yellow shirt with green details), cropped from chest up, centered, facing forward.
Replace the player name with "${d.name || 'JOGADOR'}", height with "M ${d.height || '1,75'}", date of birth with "${d.birth || '1-1-2000'}".
Maintain photorealism, consistent lighting, and professional sports card quality. The face must look exactly like the person in @image1.`,

  argentina: (d) => `Use the face and appearance of the person in @image1. Place them into the exact layout, composition, and design of @image2 (a FIFA World Cup 2026 player card for Argentina).
Keep ALL design elements from @image2 exactly the same: light blue background with geometric shapes, FIFA World Cup trophy icon, Argentina badge with "ARG 2026", large white number "2", bottom rounded white panel, green stylized "26".
The person from @image1 must be wearing an Argentina national team jersey (white and sky blue stripes), cropped from chest up, centered.
Replace the player name with "${d.name || 'JOGADOR'}", height with "M ${d.height || '1,75'}", date of birth with "${d.birth || '1-1-2000'}".
Maintain photorealism and the face must look exactly like @image1.`,

  franca: (d) => `Use the face and appearance of the person in @image1. Place them into the exact layout, composition, and design of @image2 (a FIFA World Cup 2026 player card for France).
Keep ALL design elements from @image2: blue background with geometric shapes, FIFA World Cup trophy, France badge with "FRA 2026", large white number "2", bottom rounded white panel, green stylized "26".
The person from @image1 must be wearing a France national team jersey (dark blue), cropped from chest up, centered.
Replace the player name with "${d.name || 'JOGADOR'}", height with "M ${d.height || '1,75'}", date of birth with "${d.birth || '1-1-2000'}".
Photorealistic, face must match @image1 exactly.`,

  alemanha: (d) => `Use the face and appearance of the person in @image1. Place them into the exact layout, composition, and design of @image2 (a FIFA World Cup 2026 player card for Germany).
Keep ALL design elements from @image2: grey background with geometric shapes, FIFA World Cup trophy, Germany badge with "GER 2026", large white number "2", bottom rounded white panel, green stylized "26".
The person from @image1 must be wearing a Germany national team jersey (white with black, red, yellow details), cropped from chest up, centered.
Replace the player name with "${d.name || 'JOGADOR'}", height with "M ${d.height || '1,75'}", date of birth with "${d.birth || '1-1-2000'}".
Photorealistic, face must match @image1 exactly.`,

  espanha: (d) => `Use the face and appearance of the person in @image1. Place them into the exact layout, composition, and design of @image2 (a FIFA World Cup 2026 player card for Spain).
Keep ALL design elements from @image2: red background with geometric shapes, FIFA World Cup trophy, Spain badge with "ESP 2026", large white number "2", bottom rounded white panel, green stylized "26".
The person from @image1 must be wearing a Spain national team jersey (red with yellow accents), cropped from chest up, centered.
Replace the player name with "${d.name || 'JOGADOR'}", height with "M ${d.height || '1,75'}", date of birth with "${d.birth || '1-1-2000'}".
Photorealistic, face must match @image1 exactly.`,

  portugal: (d) => `Use the face and appearance of the person in @image1. Place them into the exact layout, composition, and design of @image2 (a FIFA World Cup 2026 player card for Portugal).
Keep ALL design elements from @image2: red background with geometric shapes, FIFA World Cup trophy, Portugal badge with "POR 2026", large white number "2", bottom rounded white panel, green stylized "26".
The person from @image1 must be wearing a Portugal national team jersey (red with green details), cropped from chest up, centered.
Replace the player name with "${d.name || 'JOGADOR'}", height with "M ${d.height || '1,75'}", date of birth with "${d.birth || '1-1-2000'}".
Photorealistic, face must match @image1 exactly.`,

  uruguai: (d) => `Use the face and appearance of the person in @image1. Place them into the exact layout, composition, and design of @image2 (a FIFA World Cup 2026 player card for Uruguay).
Keep ALL design elements from @image2: light blue background with geometric shapes, FIFA World Cup trophy, Uruguay badge with "URU 2026", large white number "2", bottom rounded white panel, orange stylized "26".
The person from @image1 must be wearing a Uruguay national team jersey (light blue), cropped from chest up, centered.
Replace the player name with "${d.name || 'JOGADOR'}", height with "M ${d.height || '1,75'}", date of birth with "${d.birth || '1-1-2000'}".
Photorealistic, face must match @image1 exactly.`,

  colombia: (d) => `Use the face and appearance of the person in @image1. Place them into the exact layout, composition, and design of @image2 (a FIFA World Cup 2026 player card for Colombia).
Keep ALL design elements from @image2: yellow/gold background with geometric shapes, FIFA World Cup trophy, Colombia badge with "COL 2026", large white number "2", bottom rounded white panel, orange stylized "26".
The person from @image1 must be wearing a Colombia national team jersey (yellow with blue/red details), cropped from chest up, centered.
Replace the player name with "${d.name || 'JOGADOR'}", height with "M ${d.height || '1,75'}", date of birth with "${d.birth || '1-1-2000'}".
Photorealistic, face must match @image1 exactly.`,
};

function buildPrompt(style: string, data: StickerData): string {
  const country = data.country || 'brasil';

  if (style === 'pet') {
    return `Use the animal/pet from @image1. Place them into the exact layout and design of @image2 (a FIFA World Cup 2026 player card). The pet should be dressed as a team mascot wearing the national team jersey, centered in the card. Replace the name with "${data.name || 'MASCOTE'}", height with "M ${data.height || '0,50'}", date with "${data.birth || '1-1-2020'}". Keep all card elements from @image2. Photorealistic and fun.`;
  }

  if (style === 'grupo') {
    return `Use the group of people from @image1. Place them into the exact layout and design of @image2 (a FIFA World Cup 2026 player card). All people should be wearing the national team jersey, centered in the card. Replace the name with "${data.name || 'FAMÍLIA'}", info with "M ${data.height || '---'}", date with "${data.birth || '---'}". Keep all card elements from @image2. Photorealistic.`;
  }

  const promptFn = COUNTRY_PROMPTS[country] || COUNTRY_PROMPTS.brasil;
  return promptFn(data);
}
