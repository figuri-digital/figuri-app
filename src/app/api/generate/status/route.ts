import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyWatermark } from '@/lib/watermark';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const imageId = searchParams.get('imageId');
    const userId = searchParams.get('userId');

    if (!taskId || !imageId || !userId) {
      return NextResponse.json({ error: 'Parâmetros faltando' }, { status: 400 });
    }

    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Poll Freepik task
    const freepikRes = await fetch(
      `https://api.freepik.com/v1/ai/beta/text-to-image/reimagine-flux/${taskId}`,
      { headers: { 'x-freepik-api-key': FREEPIK_API_KEY } }
    );

    if (!freepikRes.ok) {
      return NextResponse.json({ status: 'processing' });
    }

    const freepikData = await freepikRes.json();
    const task = freepikData.data;

    if (task.status === 'FAILED') {
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      return NextResponse.json({ status: 'failed', error: 'Geração falhou. Tente outra foto.' });
    }

    if (task.status !== 'COMPLETED' || !task.generated?.length) {
      return NextResponse.json({ status: 'processing' });
    }

    // Generation complete — download, watermark, save
    const generatedImageUrl = task.generated[0];
    const genRes = await fetch(generatedImageUrl);
    const genBuffer = Buffer.from(await genRes.arrayBuffer());

    // Upload hi-res
    const hiresPath = `generated/${userId}/${imageId}.jpg`;
    await supabase.storage.from('images').upload(hiresPath, genBuffer, {
      contentType: 'image/jpeg',
    });
    const { data: hiresUrlData } = supabase.storage.from('images').getPublicUrl(hiresPath);

    // Apply watermark
    const watermarkedBuffer = await applyWatermark(genBuffer);

    // Upload preview
    const previewPath = `previews/${userId}/${imageId}.jpg`;
    await supabase.storage.from('images').upload(previewPath, watermarkedBuffer, {
      contentType: 'image/jpeg',
    });
    const { data: previewUrlData } = supabase.storage.from('images').getPublicUrl(previewPath);

    // Update image record
    await supabase.from('images').update({
      generated_url: hiresUrlData.publicUrl,
      watermark_url: previewUrlData.publicUrl,
      status: 'completed',
    }).eq('id', imageId);

    // Decrement credits
    const { data: credits } = await supabase
      .from('usage_credits')
      .select('credits_used, credits_limit')
      .eq('user_id', userId)
      .single();

    const newCreditsUsed = (credits?.credits_used || 0) + 1;
    await supabase
      .from('usage_credits')
      .update({ credits_used: newCreditsUsed })
      .eq('user_id', userId);

    return NextResponse.json({
      status: 'completed',
      previewUrl: previewUrlData.publicUrl,
      imageId,
      creditsUsed: newCreditsUsed,
      creditsLimit: credits?.credits_limit || 5,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Status check error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
