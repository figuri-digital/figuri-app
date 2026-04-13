-- Adicionar cor de texto por moldura
-- Rodar em: https://supabase.com/dashboard/project/ytzkwhozesiomcvmkgyl/sql

ALTER TABLE figurinha_configs
  ADD COLUMN IF NOT EXISTS text_colors JSONB NOT NULL
  DEFAULT '{"01":"#FFFFFF","02":"#FFFFFF","03":"#FFFFFF","04":"#FFFFFF"}'::jsonb;

-- Remove coluna antiga text_color (já substituída por text_colors)
ALTER TABLE figurinha_configs DROP COLUMN IF EXISTS text_color;
