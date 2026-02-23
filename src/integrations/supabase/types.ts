export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          config: Json
          id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          id: string
          nome_empresa: string | null
          logo_base64: string | null
          logo_nome: string | null
          llm_provider: string | null
          llm_api_key: string | null
          llm_model: string | null
          llm_base_url: string | null
          llm_status: string | null
          llm_custom_prompt: string | null
          llm_knowledge_base: string | null
          llm_tone: string | null
          llm_specialization: string | null
          llm_examples: Json | null
          llm_temperature: number | null
          llm_top_p: number | null
          llm_frequency_penalty: number | null
          llm_presence_penalty: number | null
          webhook_gptmaker: string | null
          webhook_n8n: string | null
          alerta_email_ativo: boolean | null
          alertas_ativos: boolean | null
          emails_alerta_setor: Json | null
          api_key: string | null
          empresa_id: string | null
          api_key_created_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          nome_empresa?: string | null
          logo_base64?: string | null
          logo_nome?: string | null
          llm_provider?: string | null
          llm_api_key?: string | null
          llm_model?: string | null
          llm_base_url?: string | null
          llm_status?: string | null
          llm_custom_prompt?: string | null
          llm_knowledge_base?: string | null
          llm_tone?: string | null
          llm_specialization?: string | null
          llm_examples?: Json | null
          llm_temperature?: number | null
          llm_top_p?: number | null
          llm_frequency_penalty?: number | null
          llm_presence_penalty?: number | null
          webhook_gptmaker?: string | null
          webhook_n8n?: string | null
          alerta_email_ativo?: boolean | null
          alertas_ativos?: boolean | null
          emails_alerta_setor?: Json | null
          api_key?: string | null
          empresa_id?: string | null
          api_key_created_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          nome_empresa?: string | null
          logo_base64?: string | null
          logo_nome?: string | null
          llm_provider?: string | null
          llm_api_key?: string | null
          llm_model?: string | null
          llm_base_url?: string | null
          llm_status?: string | null
          llm_custom_prompt?: string | null
          llm_knowledge_base?: string | null
          llm_tone?: string | null
          llm_specialization?: string | null
          llm_examples?: Json | null
          llm_temperature?: number | null
          llm_top_p?: number | null
          llm_frequency_penalty?: number | null
          llm_presence_penalty?: number | null
          webhook_gptmaker?: string | null
          webhook_n8n?: string | null
          alerta_email_ativo?: boolean | null
          alertas_ativos?: boolean | null
          emails_alerta_setor?: Json | null
          api_key?: string | null
          empresa_id?: string | null
          api_key_created_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      setores: {
        Row: {
          id: string
          nome: string
        }
        Insert: {
          id: string
          nome: string
        }
        Update: {
          id?: string
          nome?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          id: string
          nome: string
          login: string
          senha_hash: string
          id_setor: string | null
          role: string
          status: string
          criado_em: string
        }
        Insert: {
          id: string
          nome: string
          login: string
          senha_hash: string
          id_setor?: string | null
          role: string
          status: string
          criado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          login?: string
          senha_hash?: string
          id_setor?: string | null
          role?: string
          status?: string
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_id_setor_fkey"
            columns: ["id_setor"]
            referencedRelation: "setores"
            referencedColumns: ["id"]
          }
        ]
      }
      contratos: {
        Row: {
          id: string
          numero: string
          descricao: string
          empresa: string
          objeto: string
          tipo: string
          id_setor: string
          valor: string
          status: string
          data_inicio: string
          data_vencimento: string
          criado_por: string
          criado_em: string
          arquivo_pdf: string | null
          nome_arquivo: string | null
          excluido: boolean
          excluido_por: string | null
          excluido_em: string | null
          qtd_medicoes: number | null
          medicao_atual: number | null
          valor_medicao: string | null
          saldo_contrato: string | null
          integrado_mv: boolean | null
          id_mv: string | null
        }
        Insert: {
          id: string
          numero: string
          descricao: string
          empresa: string
          objeto: string
          tipo: string
          id_setor: string
          valor: string
          status: string
          data_inicio: string
          data_vencimento: string
          criado_por: string
          criado_em?: string
          arquivo_pdf?: string | null
          nome_arquivo?: string | null
          excluido?: boolean
          excluido_por?: string | null
          excluido_em?: string | null
          qtd_medicoes?: number | null
          medicao_atual?: number | null
          valor_medicao?: string | null
          saldo_contrato?: string | null
          integrado_mv?: boolean | null
          id_mv?: string | null
        }
        Update: {
          id?: string
          numero?: string
          descricao?: string
          empresa?: string
          objeto?: string
          tipo?: string
          id_setor?: string
          valor?: string
          status?: string
          data_inicio?: string
          data_vencimento?: string
          criado_por?: string
          criado_em?: string
          arquivo_pdf?: string | null
          nome_arquivo?: string | null
          excluido?: boolean
          excluido_por?: string | null
          excluido_em?: string | null
          qtd_medicoes?: number | null
          medicao_atual?: number | null
          valor_medicao?: string | null
          saldo_contrato?: string | null
          integrado_mv?: boolean | null
          id_mv?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_id_setor_fkey"
            columns: ["id_setor"]
            referencedRelation: "setores"
            referencedColumns: ["id"]
          }
        ]
      }
      logs: {
        Row: {
          id: string
          id_usuario: string
          nome_usuario: string
          acao: string
          detalhes: string
          timestamp: string
        }
        Insert: {
          id: string
          id_usuario: string
          nome_usuario: string
          acao: string
          detalhes: string
          timestamp?: string
        }
        Update: {
          id?: string
          id_usuario?: string
          nome_usuario?: string
          acao?: string
          detalhes?: string
          timestamp?: string
        }
        Relationships: []
      }
      alertas: {
        Row: {
          id: string
          tipo: string
          mensagem: string
          id_contrato: string | null
          numero_contrato: string | null
          empresa: string | null
          urgencia: string
          lido: boolean
          criado_em: string
        }
        Insert: {
          id: string
          tipo: string
          mensagem: string
          id_contrato?: string | null
          numero_contrato?: string | null
          empresa?: string | null
          urgencia: string
          lido?: boolean
          criado_em?: string
        }
        Update: {
          id?: string
          tipo?: string
          mensagem?: string
          id_contrato?: string | null
          numero_contrato?: string | null
          empresa?: string | null
          urgencia?: string
          lido?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      modelos_contratos: {
        Row: {
          id: string
          nome: string
          tipo: string
          descricao: string
          tags: string[]
          conteudo: string
          criado_por: string
          criado_em: string
          atualizado_em: string | null
        }
        Insert: {
          id: string
          nome: string
          tipo: string
          descricao: string
          tags?: string[]
          conteudo: string
          criado_por: string
          criado_em?: string
          atualizado_em?: string | null
        }
        Update: {
          id?: string
          nome?: string
          tipo?: string
          descricao?: string
          tags?: string[]
          conteudo?: string
          criado_por?: string
          criado_em?: string
          atualizado_em?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          id: string
          nome_fantasia: string
          razao_social: string
          cnpj: string
          classificacao: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          cep: string | null
          logradouro: string | null
          bairro: string | null
          cidade: string | null
          estado: string | null
          contato_nome: string | null
          contato_email: string | null
          contato_telefone: string | null
          criado_em: string
        }
        Insert: {
          id: string
          nome_fantasia: string
          razao_social: string
          cnpj: string
          classificacao: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          cep?: string | null
          logradouro?: string | null
          bairro?: string | null
          cidade?: string | null
          estado?: string | null
          contato_nome?: string | null
          contato_email?: string | null
          contato_telefone?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          nome_fantasia?: string
          razao_social?: string
          cnpj?: string
          classificacao?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          cep?: string | null
          logradouro?: string | null
          bairro?: string | null
          cidade?: string | null
          estado?: string | null
          contato_nome?: string | null
          contato_email?: string | null
          contato_telefone?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          id: string
          nome: string
          sigla: string
          logo: string | null
          criado_em: string
        }
        Insert: {
          id: string
          nome: string
          sigla: string
          logo?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          sigla?: string
          logo?: string | null
          criado_em?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
