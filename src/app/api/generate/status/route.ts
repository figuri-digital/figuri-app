import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyWatermark } from '@/lib/watermark';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;

export const maxDuration = 60;

const FREEPIK_FLUX_URL = 'https://api.freepik.com/v1/ai/text-to-image/flux-2-pro';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskIdsParam = searchParams.get('taskIds');
    const imageId = searchParams.get('imageId');
    const userId = searchParams.get('userId');

    if (!taskIdsParam || !imageId || !userId) {
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

    const taskIds = taskIdsParam.split(',');

    // Poll all tasks in parallel
    const statusPromises = taskIds.map(async (taskId, index) => {
      try {
        const statusRes = await fetch(`${FREEPIK_FLUX_URL}/${taskId}`, {
          method: 'GET',
          headers: { 'x-freepik-api-key': FREEPIK_API_KEY },
        });

        if (!statusRes.ok) {
          return { index, taskId, status: 'processing' };
        }

        const statusData = await statusRes.json();
        const taskStatus = statusData.data?.status;

        if (taskStatus === 'COMPLETED') {
          const generatedUrls = statusData.data?.generated;
          if (!generatedUrls?.length) {
            return { index, taskId, status: 'failed' };
          }

          // Download the generated image
          const imgRes = await fetch(generatedUrls[0]);
          if (!imgRes.ok) {
            return { index, taskId, status: 'failed' };
          }
          const genBuffer = Buffer.from(await imgRes.arrayBuffer());

          // Upload hi-res
          const hiresPath = `generated/${userId}/${imageId}-${index}.jpg`;
          await supabase.storage.from('images').upload(hiresPath, genBuffer, {
            contentType: 'image/jpeg',
          });
          const { data: hiresUrlData } = supabase.storage.from('images').getPublicUrl(hiresPath);

          // Apply watermark + upload preview
          const watermarkedBuffer = await applyWatermark(genBuffer);
          const previewPath = `previews/${userId}/${imageId}-${index}.jpg`;
          await supabase.storage.from('images').upload(previewPath, watermarkedBuffer, {
            contentType: 'image/jpeg',
          });
          const { data: previewUrlData } = supabase.storage.from('images').getPublicUrl(previewPath);

          return {
            index,
            taskId,
            status: 'completed',
            previewUrl: previewUrlData.publicUrl,
            hiresUrl: hiresUrlData.publicUrl,
          };
        }

        if (taskStatus === 'FAILED') {
          return { index, taskId, status: 'failed' };
        }

        return { index, taskId, status: 'processing' };
      } catch {
        return { index, taskId, status: 'processing' };
      }
    });

    const results = await Promise.all(statusPromises);

    const allCompleted = results.every(r => r.status === 'completed' || r.status === 'failed');
    const completedResults = results.filter(r => r.status === 'completed');

    // If all done, update image record and decrement credits
    if (allCompleted && completedResults.length > 0) {
      // Use first completed as the main record
      await supabase.from('images').update({
        generated_url: completedResults[0].hiresUrl,
        watermark_url: completedResults[0].previewUrl,
        status: 'completed',
      }).eq('id', imageId);

      // Decrement credits (1 credit per generation, not per variation)
      const { data: creds } = await supabase
        .from('usage_credits')
        .select('credits_used, credits_limit')
        .eq('user_id', userId)
        .single();

      const newCreditsUsed = (creds?.credits_used || 0) + 1;
      await supabase.from('usage_credits').update({ credits_used: newCreditsUsed }).eq('user_id', userId);

      return NextResponse.json({
        status: 'completed',
        variations: completedResults.map(r => ({
          index: r.index,
          previewUrl: r.previewUrl,
          hiresUrl: r.hiresUrl,
        })),
        imageId,
        creditsUsed: newCreditsUsed,
        creditsLimit: creds?.credits_limit || 5,
      });
    }

    // Partial results — some completed, some still processing
    return NextResponse.json({
      status: 'processing',
      variations: results.map(r => ({
        index: r.index,
        status: r.status,
        previewUrl: r.status === 'completed' ? r.previewUrl : undefined,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Status check error:', err);
    return NextResponse.json({ error: message, status: 'processing' });
  }
}
