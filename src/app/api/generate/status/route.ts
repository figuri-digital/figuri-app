import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyWatermark } from '@/lib/watermark';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;

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

    // If taskId is 'sync', it means the image was generated synchronously
    if (taskId === 'sync') {
      const authHeader = req.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '') || '';
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: img } = await supabase
        .from('images')
        .select('status, watermark_url')
        .eq('id', imageId)
        .single();

      if (img?.status === 'completed' && img?.watermark_url) {
        return NextResponse.json({
          status: 'completed',
          previewUrl: img.watermark_url,
          imageId,
        });
      }
      return NextResponse.json({ status: img?.status || 'processing' });
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

    // Poll Freepik Mystic task status
    const freepikRes = await fetch(
      `https://api.freepik.com/v1/ai/text-to-image/mystic/${taskId}`,
      {
        headers: {
          'x-freepik-api-key': FREEPIK_API_KEY,
        },
      }
    );

    console.log('Freepik Mystic status response:', freepikRes.status);

    if (!freepikRes.ok) {
      const errText = await freepikRes.text();
      console.error('Freepik Mystic status error:', freepikRes.status, errText);
      // Don't fail — might just be processing still
      return NextResponse.json({ status: 'processing' });
    }

    const freepikData = await freepikRes.json();
    console.log('Freepik Mystic status data:', JSON.stringify(freepikData).slice(0, 500));

    const task = freepikData.data || freepikData;

    // Check various status field locations
    const taskStatus = task?.status || task?.state || freepikData?.status;

    if (taskStatus === 'FAILED' || taskStatus === 'failed') {
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      return NextResponse.json({ status: 'failed', error: 'Geração falhou. Tente outra foto.' });
    }

    // Check if completed - look for generated images in various formats
    const generated = task?.generated || task?.images || task?.result?.images || freepikData?.data?.generated;

    if (!generated?.length) {
      // Still processing
      return NextResponse.json({ status: 'processing' });
    }

    // Generation complete — extract image URL
    const firstImage = generated[0];
    let generatedImageUrl: string | null = null;

    if (typeof firstImage === 'string') {
      generatedImageUrl = firstImage;
    } else if (firstImage?.url) {
      generatedImageUrl = firstImage.url;
    } else if (firstImage?.base64) {
      // If base64, we need to convert
      generatedImageUrl = null; // handle below
    }

    if (!generatedImageUrl && firstImage?.base64) {
      // Handle base64 response
      const genBuffer = Buffer.from(firstImage.base64, 'base64');

      const hiresPath = `generated/${userId}/${imageId}.jpg`;
      await supabase.storage.from('images').upload(hiresPath, genBuffer, {
        contentType: 'image/jpeg',
      });
      const { data: hiresUrlData } = supabase.storage.from('images').getPublicUrl(hiresPath);

      const watermarkedBuffer = await applyWatermark(genBuffer);
      const previewPath = `previews/${userId}/${imageId}.jpg`;
      await supabase.storage.from('images').upload(previewPath, watermarkedBuffer, {
        contentType: 'image/jpeg',
      });
      const { data: previewUrlData } = supabase.storage.from('images').getPublicUrl(previewPath);

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

    if (!generatedImageUrl) {
      console.error('No generated URL found:', JSON.stringify(freepikData).slice(0, 500));
      return NextResponse.json({ status: 'processing' });
    }

    // Download generated image
    console.log('Downloading generated image from:', generatedImageUrl);
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
    return NextResponse.json({ error: message, status: 'processing' });
  }
}
