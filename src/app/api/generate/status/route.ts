import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyWatermark } from '@/lib/watermark';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FAL_KEY = process.env.FAL_KEY!;

export const maxDuration = 60;

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

    // Check if already completed in our DB
    const { data: existingImage } = await supabase
      .from('images')
      .select('status, watermark_url')
      .eq('id', imageId)
      .single();

    if (existingImage?.status === 'completed' && existingImage?.watermark_url) {
      return NextResponse.json({
        status: 'completed',
        previewUrl: existingImage.watermark_url,
        imageId,
      });
    }

    if (existingImage?.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: 'Geração falhou. Tente outra foto.' });
    }

    // Poll fal.ai queue status
    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/flux-2-pro/edit/requests/${taskId}/status`,
      {
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
        },
      }
    );

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.error('fal.ai status error:', statusRes.status, errText);
      return NextResponse.json({ status: 'processing' });
    }

    const statusData = await statusRes.json();
    console.log('fal.ai status:', JSON.stringify(statusData).slice(0, 300));

    const queueStatus = statusData.status;

    // IN_QUEUE or IN_PROGRESS
    if (queueStatus === 'IN_QUEUE' || queueStatus === 'IN_PROGRESS') {
      return NextResponse.json({
        status: 'processing',
        queue_position: statusData.queue_position,
      });
    }

    // FAILED
    if (queueStatus === 'FAILED') {
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      return NextResponse.json({
        status: 'failed',
        error: statusData.error || 'Geração falhou. Tente outra foto.',
      });
    }

    // COMPLETED — fetch the result
    if (queueStatus === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/flux-2-pro/edit/requests/${taskId}`,
        {
          headers: {
            'Authorization': `Key ${FAL_KEY}`,
          },
        }
      );

      if (!resultRes.ok) {
        console.error('fal.ai result error:', resultRes.status);
        return NextResponse.json({ status: 'processing' });
      }

      const resultData = await resultRes.json();
      console.log('fal.ai result:', JSON.stringify(resultData).slice(0, 500));

      // Extract generated image URL
      const images = resultData.images || resultData.data?.images;
      if (!images?.length) {
        console.error('No images in fal.ai result:', JSON.stringify(resultData).slice(0, 500));
        return NextResponse.json({ status: 'processing' });
      }

      const generatedImageUrl = images[0].url || images[0];

      // Download generated image
      console.log('Downloading generated image from fal.ai...');
      const genRes = await fetch(generatedImageUrl);
      const genBuffer = Buffer.from(await genRes.arrayBuffer());

      // Upload hi-res to Supabase Storage
      const hiresPath = `generated/${userId}/${imageId}.jpg`;
      await supabase.storage.from('images').upload(hiresPath, genBuffer, {
        contentType: 'image/jpeg',
      });
      const { data: hiresUrlData } = supabase.storage.from('images').getPublicUrl(hiresPath);

      // Apply watermark
      const watermarkedBuffer = await applyWatermark(genBuffer);

      // Upload preview with watermark
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
      const { data: creds } = await supabase
        .from('usage_credits')
        .select('credits_used, credits_limit')
        .eq('user_id', userId)
        .single();

      const newCreditsUsed = (creds?.credits_used || 0) + 1;
      await supabase.from('usage_credits').update({ credits_used: newCreditsUsed }).eq('user_id', userId);

      return NextResponse.json({
        status: 'completed',
        previewUrl: previewUrlData.publicUrl,
        imageId,
        creditsUsed: newCreditsUsed,
        creditsLimit: creds?.credits_limit || 5,
      });
    }

    // Unknown status — keep polling
    return NextResponse.json({ status: 'processing' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Status check error:', err);
    return NextResponse.json({ error: message, status: 'processing' });
  }
}
