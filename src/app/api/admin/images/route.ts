export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_KEY          = process.env.ADMIN_SECRET_KEY || 'figuri-admin-2026';

interface ImageRow {
  id:            string;
  user_id:       string;
  status:        string;
  cart_status:   string;
  country:       string;
  style:         string;
  generated_url: string;
  watermark_url: string;
  original_url:  string;
  is_test:       boolean;
  created_at:    string;
}

interface OrderRow {
  image_id:     string | null;
  product_type: string;
  amount_cents: number;
  status:       string;
  coupon_code:  string | null;
  paid_at:      string | null;
}

interface ProfileRow {
  id:   string;
  name: string | null;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const cartStatus = req.nextUrl.searchParams.get('cart_status') || ''; // '' = todos
  const page       = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const pageSize   = 40;
  const onlyReal   = req.nextUrl.searchParams.get('real') !== 'false'; // padrão: só reais

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let query = supabase
    .from('images')
    .select('id, user_id, status, cart_status, country, style, generated_url, watermark_url, original_url, is_test, created_at', { count: 'exact' })
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (onlyReal) query = query.eq('is_test', false);
  if (cartStatus) query = query.eq('cart_status', cartStatus);

  const { data: images, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const imageList = (images || []) as ImageRow[];

  // Nomes dos usuários
  const userIdSet = new Set<string>();
  imageList.forEach(i => { if (i.user_id) userIdSet.add(i.user_id); });
  const userIds = Array.from(userIdSet);

  const profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);
    (profiles as ProfileRow[] || []).forEach(p => {
      profileMap[p.id] = p.name || p.id.slice(0, 8);
    });
  }

  // Pedidos associados (orders.image_id é JSON com array de itens que tem imageId)
  const { data: orders } = await supabase
    .from('orders')
    .select('image_id, product_type, amount_cents, status, coupon_code, paid_at')
    .in('status', ['paid', 'pending'])
    .order('created_at', { ascending: false });

  // Monta mapa imageId → order
  const orderMap: Record<string, OrderRow> = {};
  (orders as OrderRow[] || []).forEach(o => {
    if (!o.image_id) return;
    try {
      const items: { imageId?: string; id?: string }[] = JSON.parse(o.image_id);
      items.forEach(item => {
        const imgId = item.imageId || item.id;
        if (imgId && !orderMap[imgId]) orderMap[imgId] = o;
      });
    } catch { /* skip */ }
  });

  const enriched = imageList.map(img => ({
    ...img,
    user_name: profileMap[img.user_id] || img.user_id?.slice(0, 8) || '—',
    order:     orderMap[img.id] || null,
    // Gera URLs de todas as variações a partir do padrão de path
    variations: [0, 1].map(idx => {
      const base = img.generated_url || '';
      // generated_url tem formato: .../generated/{userId}/{imageId}-0.jpg
      // Substituímos o último índice
      return base.replace(/-\d+\.jpg$/, `-${idx}.jpg`);
    }).filter(u => u !== img.generated_url || true), // mantém ambas
  }));

  return NextResponse.json({
    images: enriched,
    total:  count || 0,
    page,
    page_size: pageSize,
    pages: Math.ceil((count || 0) / pageSize),
  });
}
