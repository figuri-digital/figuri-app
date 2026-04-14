-- Tabela de configurações de figurinhas (layouts, molduras, prompts, cor de texto)
-- Rodar no Supabase SQL Editor: https://supabase.com/dashboard/project/ytzkwhozesiomcvmkgyl/sql

CREATE TABLE IF NOT EXISTS figurinha_configs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  style        TEXT        NOT NULL,   -- sozinho | pet | casal
  country      TEXT        NOT NULL,   -- brasil | argentina | ...
  layout_file  TEXT        NOT NULL,   -- ex: brasil.jpg
  moldura_file TEXT,                   -- ex: 01-sozinho.png (nullable)
  prompt       TEXT        NOT NULL,
  text_color   TEXT        NOT NULL DEFAULT '#FFFFFF',  -- cor do texto no sticker
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(style, country)
);

-- Se a tabela já existir, só adiciona a coluna nova:
ALTER TABLE figurinha_configs ADD COLUMN IF NOT EXISTS text_color TEXT NOT NULL DEFAULT '#FFFFFF';

-- RLS
ALTER TABLE figurinha_configs ENABLE ROW LEVEL SECURITY;

-- service_role: acesso total (escrita via API admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'figurinha_configs' AND policyname = 'admin_all'
  ) THEN
    CREATE POLICY "admin_all" ON figurinha_configs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- anon: leitura pública (configs são usadas na geração pública)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'figurinha_configs' AND policyname = 'public_select'
  ) THEN
    CREATE POLICY "public_select" ON figurinha_configs
      FOR SELECT TO anon USING (true);
  END IF;
END $$;
