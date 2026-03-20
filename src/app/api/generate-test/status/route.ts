import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyWatermark } from '@/lib/watermark';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;

const MODEL_URLS: Record<string, string> = {
  'flux-2-pro': 'https://api.freepik.com/v1/ai/text-to-image/flux-2-pro',
  'nano-banana-pro': 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro',
  'seedream-v4-5': 'https://api.freepik.com/v1/ai/text-to-image/seedream-v4-5',
};

export async function GET(req: NextRequest) {
  try {
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

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const imageId = searchParams.get('imageId');
    const model = searchParams.get('model') || 'flux-2-pro';

    if (!taskId) {
      return NextResponse.json({ error: 'taskId obrigatório' }, { status: 400 });
    }

    const baseUrl = MODEL_URLS[model];
    if (!baseUrl) {
      return NextResponse.json({ error: `Modelo "${model}" não suportado` }, { status: 400 });
    }

    // Poll Freepik
    const statusRes = await fetch(`${baseUrl}/${taskId}`, {
      method: 'GET',
      headers: { 'x-freepik-api-key': FREEPIK_API_KEY },
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.error(`[TEST] Status error (${model}):`, statusRes.status, errText);
      return NextResponse.json({ error: `Status error: ${statusRes.status}` }, { status: 500 });
    }

    const statusData = await statusRes.json();
    const taskStatus = statusData.data?.status;

    if (taskStatus === 'COMPLETED') {
      const generatedUrls = statusData.data?.generated;
      if (!generatedUrls?.length) {
        return NextResponse.json({ error: 'Nenhuma imagem gerada' }, { status: 500 });
      }

      const imageUrl = generatedUrls[0];

      // Download generated image
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return NextResponse.json({ error: 'Erro ao baixar imagem' }, { status: 500 });
      }
      const genBuffer = Buffer.from(await imgRes.arrayBuffer());

      const suffix = `${model}-${imageId || taskId}`;

      // Upload hi-res
      const hiresPath = `generated/${user.id}/${suffix}.jpg`;
      await supabase.storage.from('images').upload(hiresPath, genBuffer, {
        contentType: 'image/jpeg',
      });
      const { data: hiresUrlData } = supabase.storage.from('images').getPublicUrl(hiresPath);

      // Apply watermark + upload preview
      const watermarkedBuffer = await applyWatermark(genBuffer);
      const previewPath = `previews/${user.id}/${suffix}.jpg`;
      await supabase.storage.from('images').upload(previewPath, watermarkedBuffer, {
        contentType: 'image/jpeg',
      });
      const { data: previewUrlData } = supabase.storage.from('images').getPublicUrl(previewPath);

      console.log(`[TEST] Complete: ${model} | ${suffix}`);

      return NextResponse.json({
        status: 'completed',
        previewUrl: previewUrlData.publicUrl,
        hiresUrl: hiresUrlData.publicUrl,
        model,
      });
    }

    if (taskStatus === 'FAILED') {
      return NextResponse.json({ status: 'failed', error: 'Geração falhou' });
    }

    return NextResponse.json({ status: 'processing', freepikStatus: taskStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[TEST] Status error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
