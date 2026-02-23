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
 * Persiste o AppConfig completo na tabela structured `configuracoes`.
 * Usa UPSERT para garantir que a linha singleton sempre exista.
 */
export async function saveConfiguracoes(
  config: AppConfig,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('configuracoes')
    .upsert(
      {
        id: 'default',
        nome_empresa: config.nomeEmpresa,
        logo_base64: config.logoBase64,
        logo_nome: config.logoNome,
        llm_provider: config.llmProvider,
        llm_api_key: config.llmApiKey,
        llm_model: config.llmModel,
        llm_base_url: config.llmBaseUrl,
        llm_status: config.llmStatus,
        llm_custom_prompt: config.llmCustomPrompt,
        llm_knowledge_base: config.llmKnowledgeBase,
        llm_tone: config.llmTone,
        llm_specialization: config.llmSpecialization,
        llm_examples: config.llmExamples as any,
        llm_temperature: config.llmTemperature,
        llm_top_p: config.llmTopP,
        llm_frequency_penalty: config.llmFrequencyPenalty,
        llm_presence_penalty: config.llmPresencePenalty,
        webhook_gptmaker: config.webhookGptMaker,
        webhook_n8n: config.webhookN8n,
        alerta_email_ativo: config.alertaEmailAtivo,
        alertas_ativos: config.alertasAtivos,
        emails_alerta_setor: config.emailsAlertaSetor as any,
        api_key: config.apiKey,
        empresa_id: config.empresaId,
        api_key_created_at: config.apiKeyCreatedAt,
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
 * Carrega o AppConfig da tabela structured `configuracoes`.
 * Retorna null se o registro não existir.
 */
export async function loadConfiguracoes(): Promise<AppConfig | null> {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('*')
    .eq('id', 'default')
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[configService] loadConfiguracoes failed:', error.message);
    }
    return null;
  }

  if (data) {
    return {
      nomeEmpresa: data.nome_empresa ?? undefined,
      logoBase64: data.logo_base64 ?? undefined,
      logoNome: data.logo_nome ?? undefined,
      llmProvider: data.llm_provider as any,
      llmApiKey: data.llm_api_key ?? undefined,
      llmModel: data.llm_model ?? undefined,
      llmBaseUrl: data.llm_base_url ?? undefined,
      llmStatus: data.llm_status as any,
      llmCustomPrompt: data.llm_custom_prompt ?? undefined,
      llmKnowledgeBase: data.llm_knowledge_base ?? undefined,
      llmTone: data.llm_tone as any,
      llmSpecialization: data.llm_specialization ?? undefined,
      llmExamples: data.llm_examples as any,
      llmTemperature: data.llm_temperature ?? undefined,
      llmTopP: data.llm_top_p ?? undefined,
      llmFrequencyPenalty: data.llm_frequency_penalty ?? undefined,
      llmPresencePenalty: data.llm_presence_penalty ?? undefined,
      webhookGptMaker: data.webhook_gptmaker ?? undefined,
      webhookN8n: data.webhook_n8n ?? undefined,
      alertaEmailAtivo: data.alerta_email_ativo ?? undefined,
      alertasAtivos: data.alertas_ativos ?? undefined,
      emailsAlertaSetor: data.emails_alerta_setor as any,
      apiKey: data.api_key ?? undefined,
      empresaId: data.empresa_id ?? undefined,
      apiKeyCreatedAt: data.api_key_created_at ?? undefined,
    };
  }

  return null;
}
