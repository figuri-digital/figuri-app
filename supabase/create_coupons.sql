-- Tabela de cupons de desconto
-- Rodar no Supabase SQL Editor: https://supabase.com/dashboard/project/ytzkwhozesiomcvmkgyl/sql

CREATE TABLE IF NOT EXISTS coupons (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code                TEXT        NOT NULL UNIQUE,
  description         TEXT        DEFAULT NULL,
  discount_type       TEXT        NOT NULL DEFAULT 'percent',  -- 'percent' | 'fixed'
  discount_value      NUMERIC     NOT NULL,                    -- % (ex: 10 = 10%) ou centavos (ex: 500 = R$5,00)
  min_order_cents     INTEGER     NOT NULL DEFAULT 0,          -- valor mínimo do pedido para aplicar
  max_uses            INTEGER     DEFAULT NULL,                -- NULL = ilimitado
  uses_count          INTEGER     NOT NULL DEFAULT 0,
  expires_at          TIMESTAMPTZ DEFAULT NULL,                -- NULL = sem expiração
  first_purchase_only BOOLEAN     NOT NULL DEFAULT FALSE,
  active              BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS coupons_code_idx   ON coupons(code);
CREATE INDEX IF NOT EXISTS coupons_active_idx ON coupons(active);

-- RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- service_role: acesso total
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'coupons_service_all'
  ) THEN
    CREATE POLICY "coupons_service_all" ON coupons
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Usuários autenticados podem apenas ler cupons ativos (para validação no frontend)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'coupons_auth_select'
  ) THEN
    CREATE POLICY "coupons_auth_select" ON coupons
      FOR SELECT TO authenticated USING (active = true);
  END IF;
END $$;

-- Adicionar colunas coupon_code e discount_cents na tabela orders (se ainda não existirem)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code    TEXT    DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_cents INTEGER DEFAULT NULL;

-- Função para incrementar uses_count de forma atômica
CREATE OR REPLACE FUNCTION increment_coupon_uses(coupon_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE coupons SET uses_count = uses_count + 1, updated_at = NOW()
  WHERE id = coupon_id;
$$;
