import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createGeneration, pollTask, getPrompt } from '@/lib/freepik';
import { applyWatermark } from '@/lib/watermark';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    // Auth: get user from token
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

    // Check credits
    const { data: credits } = await supabase
      .from('usage_credits')
      .select('credits_used, credits_limit')
      .eq('user_id', user.id)
      .single();

    if (!credits) {
      return NextResponse.json({ error: 'Créditos não encontrados' }, { status: 400 });
    }

    if (credits.credits_used >= credits.credits_limit) {
      return NextResponse.json({
        error: 'Você usou todos os previews gratuitos. Adquira créditos para continuar.',
      }, { status: 403 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('photo') as File | null;
    const style = (formData.get('style') as string) || 'jogador';
    const name = (formData.get('name') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Envie uma foto' }, { status: 400 });
    }

    // Convert to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    // Upload original to Supabase Storage
    const imageId = uuidv4();
    const originalPath = `originals/${user.id}/${imageId}.jpg`;

    await supabase.storage.from('images').upload(originalPath, buffer, {
      contentType: file.type || 'image/jpeg',
    });

    const { data: originalUrlData } = supabase.storage
      .from('images')
      .getPublicUrl(originalPath);

    // Call Freepik API
    const prompt = getPrompt(style, name);
    const taskId = await createGeneration(base64, prompt);
    const generatedImageUrl = await pollTask(taskId);

    // Download generated image
    const genRes = await fetch(generatedImageUrl);
    const genBuffer = Buffer.from(await genRes.arrayBuffer());

    // Upload hi-res (clean) to storage
    const hiresPath = `generated/${user.id}/${imageId}.jpg`;
    await supabase.storage.from('images').upload(hiresPath, genBuffer, {
      contentType: 'image/jpeg',
    });

    const { data: hiresUrlData } = supabase.storage
      .from('images')
      .getPublicUrl(hiresPath);

    // Apply watermark
    const watermarkedBuffer = await applyWatermark(genBuffer);

    // Upload watermarked preview
    const previewPath = `previews/${user.id}/${imageId}.jpg`;
    await supabase.storage.from('images').upload(previewPath, watermarkedBuffer, {
      contentType: 'image/jpeg',
    });

    const { data: previewUrlData } = supabase.storage
      .from('images')
      .getPublicUrl(previewPath);

    // Save image record
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('images').insert({
      id: imageId,
      user_id: user.id,
      original_url: originalUrlData.publicUrl,
      generated_url: hiresUrlData.publicUrl,
      watermark_url: previewUrlData.publicUrl,
      style,
      prompt,
      status: 'completed',
      expires_at: expiresAt,
      cart_status: 'preview',
    });

    // Decrement credits
    const newCreditsUsed = credits.credits_used + 1;
    await supabase
      .from('usage_credits')
      .update({ credits_used: newCreditsUsed })
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      previewUrl: previewUrlData.publicUrl,
      imageId,
      creditsUsed: newCreditsUsed,
      creditsLimit: credits.credits_limit,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Generate error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
