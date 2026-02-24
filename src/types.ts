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

export type TipoContrato = 'Serviços de TI' | 'Sistema / Software' | 'Infraestrutura' | 'Implantação' | 'Manutenção' | 'Obra' | 'Outros';

export type ModeloCobranca = 'ti' | 'geral';

export type StatusParcela = 'pendente' | 'pago';

export interface Parcela {
  id: string;
  idContrato: string;
  numero: number;
  valor: string;
  dataVencimento: string; // ISO format
  status: StatusParcela;
  quitado: boolean;
  criadoEm: string;
  atualizadoEm?: string;
  multa?: number;
  juros?: number;
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
  status: 'Vigente' | 'Vencendo' | 'Vencido' | 'Encerrado' | 'Quitado' | 'Em Aberto';
  dataInicio: string;
  dataVencimento: string;
  criadoPor: string;
  criadoEm: string;
  arquivoPdf?: string;
  nomeArquivo?: string;
  excluido?: boolean;
  excluidoPor?: string;
  excluidoEm?: string;
  // Vigência
  vigenciaMeses?: number;
  // Modelo financeiro
  modeloCobranca?: ModeloCobranca;
  valorImplantacao?: string;
  valorManutencaoMensal?: string;
  qtdPagamentos?: number;
  valorPrestacao?: string;
  multaPercentual?: number;
  // Campos específicos para contratos de Obra
  qtdMedicoes?: number;
  medicaoAtual?: number;
  valorMedicao?: string;
  saldoContrato?: string;
  // Parcelas (loaded separately)
  parcelas?: Parcela[];
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
  gptMakerAgentId?: string;
  gptMakerApiKey?: string;
  nomeEmpresa?: string;
  alertaEmailAtivo?: boolean;
  alertasAtivos?: boolean;
  emailsAlertaSetor?: Record<string, string>;
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
  tiposContrato?: string[];
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
  logo?: string;
  criadoEm: string;
}
