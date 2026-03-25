export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FAL_KEY = process.env.FAL_KEY!;

export const maxDuration = 60;

const FAL_FLUX_URL = 'https://queue.fal.run/fal-ai/flux-2-pro/edit';
const NUM_VARIATIONS = 2;

// Test emails — unlimited credits, flagged as test in dashboard
const TEST_EMAILS = ['guilhermevto@gmail.com', 'karina_dias125@hotmail.com'];

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

    const isTestUser = TEST_EMAILS.includes(user.email || '');

    // Check/create credits (skip limit for test users)
    let { data: credits } = await supabase
      .from('usage_credits')
      .select('credits_used, credits_limit')
      .eq('user_id', user.id)
      .single();

    if (!credits) {
      await supabase.from('usage_credits').insert({
        user_id: user.id,
        credits_used: 0,
        credits_limit: isTestUser ? 99999 : 5,
      });
      credits = { credits_used: 0, credits_limit: isTestUser ? 99999 : 5 };
    }

    if (!isTestUser && credits.credits_used >= credits.credits_limit) {
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

    // Get layout URL (new system: layout = player only, moldura applied in editor)
    const host = req.headers.get('host') || 'figuri-app.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    let layoutUrl: string;
    if (style === 'pet') {
      const petFile = PET_LAYOUTS[country] || PET_LAYOUTS.brasil;
      layoutUrl = `${protocol}://${host}/assets/layouts/Pet/${petFile}`;
    } else {
      const layoutFile = COUNTRY_LAYOUTS[country] || COUNTRY_LAYOUTS.brasil;
      layoutUrl = `${protocol}://${host}/assets/layouts/${layoutFile}`;
    }

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
      is_test: isTestUser,
    });

    // Submit 3 generation tasks to fal.ai Flux 2 Pro in parallel
    console.log(`Submitting ${NUM_VARIATIONS} Flux 2 Pro tasks via fal.ai...`);
    console.log('Country:', country, '| Style:', style, '| Test:', isTestUser);

    const taskPromises = Array.from({ length: NUM_VARIATIONS }, () =>
      fetch(FAL_FLUX_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_urls: [originalUrlData.publicUrl, layoutUrl],
          image_size: 'portrait_4_3',
          output_format: 'jpeg',
          safety_tolerance: '3',
        }),
      })
    );

    const responses = await Promise.all(taskPromises);
    const tasks: { requestId: string; statusUrl: string; responseUrl: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      if (!res.ok) {
        const errText = await res.text();
        console.error(`fal.ai task ${i + 1} error:`, res.status, errText);
        errors.push(`Task ${i + 1}: ${res.status} - ${errText.slice(0, 200)}`);
        continue;
      }
      const data = await res.json();
      console.log(`Task ${i + 1} response:`, JSON.stringify(data).slice(0, 500));
      const requestId = data.request_id;
      if (requestId) {
        tasks.push({
          requestId,
          statusUrl: data.status_url || '',
          responseUrl: data.response_url || '',
        });
        console.log(`Task ${i + 1} queued:`, requestId, '| status_url:', data.status_url);
      } else {
        errors.push(`Task ${i + 1}: sem request_id - ${JSON.stringify(data).slice(0, 200)}`);
      }
    }

    if (tasks.length === 0) {
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      const errorDetail = errors.join(' | ') || 'Sem detalhes';
      console.error('All tasks failed:', errorDetail);
      return NextResponse.json({ error: `Falha na geração: ${errorDetail}` }, { status: 500 });
    }

    console.log(`${tasks.length} tasks queued for imageId ${imageId}`);

    return NextResponse.json({
      success: true,
      imageId,
      userId: user.id,
      taskIds: tasks.map(t => t.requestId),
      statusUrls: tasks.map(t => t.statusUrl),
      responseUrls: tasks.map(t => t.responseUrl),
      status: 'processing',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Generate error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Country layouts (player only, no frame/moldura) ──

const COUNTRY_LAYOUTS: Record<string, string> = {
  brasil: 'brasil.jpg',
  argentina: 'argentina.jpg',
  colombia: 'colombia.jpg',
  uruguai: 'uruguai.jpg',
  franca: 'franca.png',
  alemanha: 'alemanha.png',
  espanha: 'espanha.png',
  portugal: 'portugal.png',
};

const PET_LAYOUTS: Record<string, string> = {
  brasil: 'brasil.png',
  argentina: 'argentina.png',
  colombia: 'colombia.png',
  uruguai: 'uruguai.png',
  franca: 'franca.png',
  alemanha: 'alemanha.png',
  espanha: 'espanha.png',
  portugal: 'portugal.png',
};

// ── Prompts ──

interface StickerData {
  name?: string;
  birth?: string;
  height?: string;
  country?: string;
}

const COUNTRY_PROMPTS: Record<string, string> = {
  brasil: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, neutral expression, and proportions. Preserve the green background with abstract shapes and the large number behind completely unchanged. Also keep the Brazil national team jersey identical (colors, texture, logo, and details). The new person should be centered, facing forward, with a realistic appearance and seamless integration with the original lighting.',
  argentina: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire blue background with abstract shapes and the large number behind unchanged. Keep the Argentina national team jersey identical (colors, stripes, texture, logo, and details). The new person must be centered, facing forward, with realistic skin tones and natural shadows, seamlessly blended with the original lighting and composition.',
  colombia: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire yellow background with abstract shapes and the large number behind completely unchanged. Keep the Colombia national team jersey identical (colors, texture, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  uruguai: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and facial expression (slight smile). Preserve the entire light blue background with abstract shapes and the large number behind completely unchanged. Keep the Uruguay national team jersey identical (colors, texture, logo, collar, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  franca: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire background with abstract shapes and the large number behind completely unchanged. Keep the France national team jersey identical (dark blue color, texture, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  alemanha: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire background with abstract shapes and the large number behind completely unchanged. Keep the Germany national team jersey identical (white color, texture, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  espanha: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire background with abstract shapes and the large number behind completely unchanged. Keep the Spain national team jersey identical (red color, texture, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  portugal: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire background with abstract shapes and the large number behind completely unchanged. Keep the Portugal national team jersey identical (dark red/burgundy color, texture, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
};

function buildPrompt(style: string, data: StickerData): string {
  const country = data.country || 'brasil';
  return COUNTRY_PROMPTS[country] || COUNTRY_PROMPTS.brasil;
}
