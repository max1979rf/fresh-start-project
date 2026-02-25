-- Migration: Relax sector constraints to allow deletion
-- Makes id_setor nullable in contratos and adds ON DELETE SET NULL

-- 1. Update contratos table
ALTER TABLE public.contratos 
  ALTER COLUMN id_setor DROP NOT NULL;

-- 2. Drop existing foreign key and recreate with ON DELETE SET NULL
-- We need to find the constraint name first, but usually it's contratos_id_setor_fkey
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contratos_id_setor_fkey') THEN
        ALTER TABLE public.contratos DROP CONSTRAINT contratos_id_setor_fkey;
    END IF;
END $$;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_id_setor_fkey 
  FOREIGN KEY (id_setor) 
  REFERENCES public.setores(id) 
  ON DELETE SET NULL;

-- 3. Ensure usuarios table also has ON DELETE SET NULL (it should already, but let's be sure)
-- Finding the constraint for usuarios
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_id_setor_fkey') THEN
        ALTER TABLE public.usuarios DROP CONSTRAINT usuarios_id_setor_fkey;
    END IF;
END $$;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_id_setor_fkey 
  FOREIGN KEY (id_setor) 
  REFERENCES public.setores(id) 
  ON DELETE SET NULL;
