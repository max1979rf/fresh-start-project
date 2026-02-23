/**
 * configService.ts
 *
 * Persiste e recupera todas as configurações da aplicação na tabela
 * `app_config` do Supabase (já existente no banco).
 *
 * A tabela possui a coluna `config JSONB` que armazena o objeto AppConfig
 * completo. O registro singleton usa id = 'default'.
 *
 * Usa o cliente Supabase diretamente (sem edge function), o que é suficiente
 * já que a política RLS da tabela permite acesso público.
 *
 * API pública
 * ───────────
 *   saveConfiguracoes(config)  → Promise<{ error: string | null }>
 *   loadConfiguracoes()        → Promise<AppConfig | null>
 */

import { supabase } from '@/integrations/supabase/client';
import type { AppConfig } from '@/types';

// ─── Salvar ──────────────────────────────────────────────────────────────────

/**
 * Persiste o AppConfig completo na tabela `app_config`.
 * Usa UPSERT para garantir que a linha singleton sempre exista.
 */
export async function saveConfiguracoes(
  config: AppConfig,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('app_config')
    .upsert(
      {
        id: 'default',
        config: config as unknown as import('@/integrations/supabase/types').Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

  if (error) {
    console.error('[configService] saveConfiguracoes failed:', error.message);
    return { error: error.message };
  }

  return { error: null };
}

// ─── Carregar ─────────────────────────────────────────────────────────────────

/**
 * Carrega o AppConfig da tabela `app_config`.
 * Retorna null se o registro não existir (primeira execução).
 */
export async function loadConfiguracoes(): Promise<AppConfig | null> {
  const { data, error } = await supabase
    .from('app_config')
    .select('config')
    .eq('id', 'default')
    .single();

  if (error) {
    // PGRST116 = "no rows returned" — normal antes da primeira gravação
    if (error.code !== 'PGRST116') {
      console.error('[configService] loadConfiguracoes failed:', error.message);
    }
    return null;
  }

  if (data?.config && typeof data.config === 'object' && !Array.isArray(data.config)) {
    return data.config as unknown as AppConfig;
  }

  return null;
}
