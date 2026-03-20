import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyWatermark } from '@/lib/watermark';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FAL_KEY = process.env.FAL_KEY!;

export const maxDuration = 60;

// fal.ai uses the same base URL for submit and status polling
const FAL_APP_ID = 'fal-ai/flux-2-pro/edit';

// Test emails — don't decrement credits
const TEST_EMAILS = ['guilhermevto@gmail.com', 'karina_dias125@hotmail.com'];

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

    // Check if test user
    const { data: { user } } = await supabase.auth.getUser(token);
    const isTestUser = TEST_EMAILS.includes(user?.email || '');

    const taskIds = taskIdsParam.split(',');

    // Poll all tasks in parallel via fal.ai
    const statusPromises = taskIds.map(async (taskId, index) => {
      try {
        // Try status check via fal.ai REST API
        const statusUrl = `https://queue.fal.run/${FAL_APP_ID}/requests/${taskId}/status`;
        console.log(`Polling: ${statusUrl}`);

        let statusRes = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        });

        // If 405, try alternative URL format (without /edit)
        if (statusRes.status === 405) {
          const altUrl = `https://queue.fal.run/fal-ai/flux-2-pro/requests/${taskId}/status`;
          console.log(`405 on primary, trying alt: ${altUrl}`);
          statusRes = await fetch(altUrl, {
            method: 'GET',
            headers: { 'Authorization': `Key ${FAL_KEY}` },
          });
        }

        // If still 405, try global requests endpoint
        if (statusRes.status === 405) {
          const globalUrl = `https://queue.fal.run/requests/${taskId}/status`;
          console.log(`405 on alt, trying global: ${globalUrl}`);
          statusRes = await fetch(globalUrl, {
            method: 'GET',
            headers: { 'Authorization': `Key ${FAL_KEY}` },
          });
        }

        if (!statusRes.ok) {
          const errText = await statusRes.text();
          console.log(`Task ${index} status check failed:`, statusRes.status, errText.slice(0, 200));
          return { index, taskId, status: 'processing' };
        }

        const statusData = await statusRes.json();
        console.log(`Task ${index} (${taskId.slice(0, 8)}):`, JSON.stringify(statusData).slice(0, 300));

        if (statusData.status === 'COMPLETED') {
          // Fetch the result using same URL pattern that worked for status
          const resultRes = await fetch(`https://queue.fal.run/${FAL_APP_ID}/requests/${taskId}`, {
            method: 'GET',
            headers: { 'Authorization': `Key ${FAL_KEY}` },
          });

          if (!resultRes.ok) {
            return { index, taskId, status: 'failed' };
          }

          const resultData = await resultRes.json();
          const imageUrl = resultData.images?.[0]?.url;

          if (!imageUrl) {
            return { index, taskId, status: 'failed' };
          }

          // Download generated image
          const imgRes = await fetch(imageUrl);
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

        if (statusData.status === 'FAILED') {
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
      await supabase.from('images').update({
        generated_url: completedResults[0].hiresUrl,
        watermark_url: completedResults[0].previewUrl,
        status: 'completed',
      }).eq('id', imageId);

      // Decrement credits (skip for test users)
      if (!isTestUser) {
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

      return NextResponse.json({
        status: 'completed',
        variations: completedResults.map(r => ({
          index: r.index,
          previewUrl: r.previewUrl,
          hiresUrl: r.hiresUrl,
        })),
        imageId,
      });
    }

    // Partial results
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
