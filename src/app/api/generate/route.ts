import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createGeneration, getPrompt } from '@/lib/freepik';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
        error: 'Você usou todos os previews gratuitos.',
      }, { status: 403 });
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

    // Start Freepik generation (async — returns immediately)
    const prompt = getPrompt(style, { name, birth, height, country });
    const taskId = await createGeneration(base64, prompt);

    // Save image record with pending status
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

    // Return task info immediately — frontend will poll /api/generate/status
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
