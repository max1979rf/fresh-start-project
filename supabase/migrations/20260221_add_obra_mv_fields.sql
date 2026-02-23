-- Migration: add obra (construction) and MV system integration fields
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS qtd_medicoes     INTEGER;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS medicao_atual    INTEGER;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_medicao    TEXT;       -- formatted "R$ X.XXX,XX"
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS saldo_contrato   TEXT;       -- formatted "R$ X.XXX,XX"
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS integrado_mv     BOOLEAN DEFAULT FALSE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS id_mv            TEXT;

-- Optional: add comments for documentation
COMMENT ON COLUMN contratos.qtd_medicoes   IS 'Quantidade total de medições previstas (apenas contratos de Obra)';
COMMENT ON COLUMN contratos.medicao_atual  IS 'Número da medição atual (apenas contratos de Obra)';
COMMENT ON COLUMN contratos.valor_medicao  IS 'Valor da medição atual, formato "R$ X.XXX,XX" (apenas contratos de Obra)';
COMMENT ON COLUMN contratos.saldo_contrato IS 'Saldo restante do contrato após medições, formato "R$ X.XXX,XX"';
COMMENT ON COLUMN contratos.integrado_mv   IS 'TRUE quando o contrato já foi sincronizado com o Sistema MV';
COMMENT ON COLUMN contratos.id_mv          IS 'Identificador do contrato no Sistema MV';
