export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_KEY        = process.env.ADMIN_SECRET_KEY || 'figuri-admin-2026';

interface OrderRow {
  id:               string;
  payment_id:       string;
  user_id:          string;
  amount_cents:     number;
  status:           string;
  product_type:     string;
  image_id:         string | null;
  shipping_info:    string | null;
  delivery_address: string | null;
  coupon_code:      string | null;
  discount_cents:   number | null;
  paid_at:          string | null;
  created_at:       string;
}

interface ProfileRow {
  id:   string;
  name: string | null;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const status   = req.nextUrl.searchParams.get('status')   || '';   // '' = todos
  const search   = req.nextUrl.searchParams.get('search')   || '';   // payment_id ou coupon_code
  const page     = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const pageSize = 50;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq('status', status);
  if (search) {
    query = query.or(`payment_id.ilike.%${search}%,coupon_code.ilike.%${search}%`);
  }

  const { data: orders, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orderList = (orders || []) as OrderRow[];

  // Busca nomes dos usuários
  const userIdSet = new Set<string>();
  orderList.forEach(o => { if (o.user_id) userIdSet.add(o.user_id); });
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

  const enriched = orderList.map(o => ({
    ...o,
    user_name:       profileMap[o.user_id] || o.user_id?.slice(0, 8) || '—',
    shipping_parsed: o.shipping_info ? (() => {
      try { return JSON.parse(o.shipping_info!); } catch { return null; }
    })() : null,
    address_parsed: o.delivery_address ? (() => {
      try { return JSON.parse(o.delivery_address!); } catch { return null; }
    })() : null,
    items_parsed: o.image_id ? (() => {
      try { return JSON.parse(o.image_id!); } catch { return null; }
    })() : null,
  }));

  return NextResponse.json({
    orders: enriched,
    total:  count || 0,
    page,
    page_size: pageSize,
    pages: Math.ceil((count || 0) / pageSize),
  });
}
