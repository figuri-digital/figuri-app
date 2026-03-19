import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;

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

    // Check/create credits (handles case where trigger didn't fire)
    let { data: credits } = await supabase
      .from('usage_credits')
      .select('credits_used, credits_limit')
      .eq('user_id', user.id)
      .single();

    if (!credits) {
      // Create credits row if missing (e.g., Google auth users)
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

    // Also ensure profile exists
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
    const style = (formData.get('style') as string) || 'jogador';
    const name = (formData.get('name') as string) || '';
    const birth = (formData.get('birth') as string) || '';
    const height = (formData.get('height') as string) || '';
    const country = (formData.get('country') as string) || 'brasil';

    if (!file) {
      return NextResponse.json({ error: 'Envie uma foto' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const imageId = uuidv4();

    // Step 1: Upload to Supabase Storage to get a public URL
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

    const publicImageUrl = originalUrlData.publicUrl;

    // Step 2: Build prompt
    const prompt = buildPrompt(style, { name, birth, height, country });

    // Step 3: Start Freepik generation with base64
    const base64 = buffer.toString('base64');
    console.log('Starting Freepik generation...');
    const taskId = await startFreepikGeneration(base64, prompt);
    console.log('Freepik taskId:', taskId);

    // Step 4: Save image record
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('images').insert({
      id: imageId,
      user_id: user.id,
      original_url: publicImageUrl,
      generated_url: '',
      watermark_url: '',
      style,
      prompt,
      status: 'processing',
      expires_at: expiresAt,
      cart_status: 'preview',
    });

    return NextResponse.json({
      success: true,
      taskId,
      imageId,
      userId: user.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Generate error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Freepik API ──

async function startFreepikGeneration(imageBase64: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.freepik.com/v1/ai/beta/text-to-image/reimagine-flux', {
    method: 'POST',
    headers: {
      'x-freepik-api-key': FREEPIK_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBase64,
      prompt,
      imagination: 'subtle',
      aspect_ratio: 'traditional_3_4',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Freepik API response:', res.status, errText);
    throw new Error(`Freepik API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  console.log('Freepik response:', JSON.stringify(data).slice(0, 300));

  if (data.data?.task_id) {
    return data.data.task_id;
  }

  console.error('Unexpected Freepik response:', JSON.stringify(data).slice(0, 500));
  throw new Error('Resposta inesperada da API Freepik');
}

// ── Prompts ──

interface StickerData {
  name?: string;
  birth?: string;
  height?: string;
  country?: string;
}

const COUNTRY_MAP: Record<string, { jersey: string; flag: string }> = {
  brasil:    { jersey: 'yellow Brazil national team jersey with green details', flag: 'Brazilian' },
  argentina: { jersey: 'white and light blue striped Argentina national team jersey', flag: 'Argentine' },
  franca:    { jersey: 'dark blue France national team jersey', flag: 'French' },
  alemanha:  { jersey: 'white Germany national team jersey with black details', flag: 'German' },
  espanha:   { jersey: 'red Spain national team jersey', flag: 'Spanish' },
  portugal:  { jersey: 'dark red Portugal national team jersey', flag: 'Portuguese' },
  uruguai:   { jersey: 'light blue Uruguay national team jersey', flag: 'Uruguayan' },
  colombia:  { jersey: 'yellow Colombia national team jersey', flag: 'Colombian' },
};

function getCountryInfo(country?: string) {
  return COUNTRY_MAP[country || 'brasil'] || COUNTRY_MAP.brasil;
}

function buildPrompt(style: string, data: StickerData): string {
  const c = getCountryInfo(data.country);
  const info = [data.name, data.height, data.birth].filter(Boolean).join(' · ');

  const prompts: Record<string, string> = {
    sozinho: `Official World Cup 2026 Panini sticker card, photorealistic portrait, wearing ${c.jersey} number 10, gold decorative border frame, player name "${data.name || 'JOGADOR'}" at bottom in bold white text, ${c.flag} flag icon top right, player info "${info}" in small text, white card background, studio lighting, 2K quality`,
    pet: `Official World Cup 2026 Panini sticker card, cute animal as team mascot wearing ${c.jersey}, gold decorative border frame, name "${data.name || 'MASCOTE'}" at bottom, ${c.flag} flag, team badge, white card background, studio lighting, 2K quality`,
    grupo: `Official World Cup 2026 Panini sticker card, family group photo wearing ${c.jersey}, gold decorative border frame, "${data.name || 'FAMÍLIA'}" text at bottom, ${c.flag} flag, white card background, studio lighting, 2K quality`,
    rara: `Official World Cup 2026 Panini RARE holographic sticker card, photorealistic portrait, wearing ${c.jersey} number 10, silver holographic border with rainbow reflections, RARE badge top left, player name "${data.name || 'JOGADOR'}" at bottom in bold metallic text, player info "${info}", ${c.flag} flag icon, premium card background with sparkle effects, studio lighting, 2K quality`,
  };

  return prompts[style] || prompts.sozinho;
}
