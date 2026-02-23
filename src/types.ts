export interface Setor {
  id: string;
  nome: string;
}

export interface User {
  id: string;
  nome: string;
  login: string;
  senhaHash: string;
  idSetor: string | null; // null for admin
  role: 'admin' | 'setor';
  status: 'ativo' | 'inativo';
  criadoEm: string;
}

export interface Contrato {
  id: string;
  numero: string;
  descricao: string;
  empresa: string;
  objeto: string;
  tipo: string;
  idSetor: string;
  valor: string;
  status: 'Vigente' | 'Vencendo' | 'Vencido' | 'Encerrado';
  dataInicio: string;
  dataVencimento: string;
  criadoPor: string;
  criadoEm: string;
  arquivoPdf?: string; // base64 data URI
  nomeArquivo?: string;
  excluido?: boolean;
  excluidoPor?: string;
  excluidoEm?: string;
  // Campos específicos para contratos de Obra (construção civil)
  qtdMedicoes?: number;    // Quantidade total de medições previstas
  medicaoAtual?: number;   // Número da medição atual
  valorMedicao?: string;   // Valor da medição atual (ex: "R$ 15.000,00")
  saldoContrato?: string;  // Saldo restante após medições (ex: "R$ 200.000,00")
  // Integração com Sistema MV
  integradoMv?: boolean;   // Se o contrato já foi sincronizado com o MV
  idMv?: string;           // Identificador do contrato no Sistema MV
}

export interface LogEntry {
  id: string;
  idUsuario: string;
  nomeUsuario: string;
  acao: string;
  detalhes: string;
  timestamp: string;
}

export interface Alerta {
  id: string;
  tipo: 'vencimento' | 'clausula_abusiva' | 'analise_ia' | 'geral';
  mensagem: string;
  idContrato?: string;
  numeroContrato?: string;
  empresa?: string;
  urgencia: 'critica' | 'alta' | 'media' | 'baixa';
  lido: boolean;
  criadoEm: string;
}

export interface AppConfig {
  logoBase64?: string;
  logoNome?: string;
  webhookGptMaker?: string;
  webhookN8n?: string;
  nomeEmpresa?: string;
  alertaEmailAtivo?: boolean;
  alertasAtivos?: boolean;
  emailsAlertaSetor?: Record<string, string>; // { [setorId]: email }
  // LLM Integration (RF01)
  llmProvider?: 'openai' | 'anthropic' | 'google' | 'meta' | 'mistral' | 'cohere' | 'deepseek' | 'groq' | 'perplexity' | 'xai' | 'gptmaker' | 'custom';
  llmApiKey?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  llmStatus?: 'connected' | 'disconnected' | 'error';
  llmCustomPrompt?: string;
  llmKnowledgeBase?: string;
  llmTone?: 'formal' | 'informal' | 'tecnico';
  llmSpecialization?: string;
  llmExamples?: { user: string; assistant: string }[];
  llmTemperature?: number;
  llmTopP?: number;
  llmFrequencyPenalty?: number;
  llmPresencePenalty?: number;
  // API Aberta (RF03)
  apiKey?: string;
  empresaId?: string;
  apiKeyCreatedAt?: string;
}

export interface ModeloContrato {
  id: string;
  nome: string;
  tipo: string;
  descricao: string;
  tags: string[];
  conteudo: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm?: string;
}

export interface Cliente {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  classificacao: 'Matriz' | 'Filial' | 'Parceiro';
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  contatoNome?: string;
  contatoEmail?: string;
  contatoTelefone?: string;
  criadoEm: string;
}

export interface Empresa {
  id: string;
  nome: string;
  sigla: string;
  logo?: string; // base64
  criadoEm: string;
}
