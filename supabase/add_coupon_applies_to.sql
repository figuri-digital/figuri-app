-- Adiciona coluna applies_to na tabela coupons
-- NULL = aplica em todos os produtos
-- Ex: '{fisica,moldura}' = só figurinhas físicas e com moldura
-- Rodar no Supabase SQL Editor: https://supabase.com/dashboard/project/ytzkwhozesiomcvmkgyl/sql

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applies_to TEXT[] DEFAULT NULL;
