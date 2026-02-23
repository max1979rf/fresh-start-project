import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { callLlmApi } from './llmService';
import type { AppConfig } from '../types';

// For pdfjs-dist v5.x, use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
).toString();

/**
 * Extracts full text from a PDF base64 data URI.
 * Falls back to OCR via LLM vision if text content is sparse.
 */
export async function extractTextFromPdf(dataUri: string, config?: AppConfig): Promise<string> {
    try {
        // Convert base64 data URI to Uint8Array
        const base64 = dataUri.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const pages: string[] = [];
        console.log(`Extracting text from PDF (${pdf.numPages} pages)...`);

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const text = content.items
                .map((item: unknown) => (item as { str: string }).str)
                .join(' ');
            pages.push(text.trim());
        }

        const fullText = pages.join('\n').trim();
        console.log(`Extracted ${fullText.length} characters from PDF.`);

        // Fallback to OCR if text is suspicious (scanned document)
        if (fullText.length < 50 && pdf.numPages > 0 && config && config.llmApiKey) {
            console.log('PDF text sparse, falling back to LLM OCR...');
            return await extractTextFromScannedPdf(dataUri, config);
        }

        return fullText;
    } catch (err) {
        console.warn('PDF text extraction failed:', err);
        return '';
    }
}

/**
 * Renders PDF pages to base64 images for OCR.
 */
export async function renderPdfToImages(dataUri: string): Promise<string[]> {
    try {
        const base64 = dataUri.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const images: string[] = [];

        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) { // Limit to 5 pages for cost/speed
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await (page as any).render({ canvasContext: context, viewport, canvas }).promise;
            images.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        }
        return images;
    } catch (err) {
        console.error('Failed to render PDF to images:', err);
        return [];
    }
}

/**
 * Triggers LLM OCR on PDF page images.
 */
export async function extractTextFromScannedPdf(dataUri: string, config: AppConfig): Promise<string> {
    const images = await renderPdfToImages(dataUri);
    if (images.length === 0) {
        console.warn('OCR fallback: no images rendered from PDF.');
        return '';
    }

    console.log(`Starting LLM OCR for ${images.length} pages...`);
    const transcriptions: string[] = [];

    // Process pages sequentially to avoid overwhelming API limits
    for (let i = 0; i < images.length; i++) {
        const result = await callLlmApi(
            config,
            [{
                role: 'user',
                content: `Transcreva EXATAMENTE todo o texto desta página de contrato (Página ${i + 1}). Mantenha a formatação de cláusulas se possível. Retorne apenas o texto transcrito.`,
                imageBase64: images[i]
            }],
            "Você é um especialista em OCR jurídico. Transcreva documentos com precisão absoluta."
        );
        if (result) transcriptions.push(result);
    }

    return transcriptions.join('\n\n--- PRÓXIMA PÁGINA ---\n\n');
}

/**
 * Extracts text from a DOCX file by parsing the ZIP structure directly.
 * Uses JSZip to avoid mammoth's Node.js unzip incompatibility in browser.
 */
export async function extractTextFromDocx(file: File): Promise<string> {
    try {
        const name = (file.name || '').toLowerCase();
        if (name.endsWith('.doc') && !name.endsWith('.docx')) {
            throw new Error('Formato .doc (antigo) não é suportado. Converta para .docx e tente novamente.');
        }

        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        // DOCX is a ZIP containing XML files. Main content is in word/document.xml
        const docXml = zip.file('word/document.xml');
        if (!docXml) {
            throw new Error('Arquivo DOCX inválido: não foi possível encontrar o conteúdo principal.');
        }

        const xmlContent = await docXml.async('text');

        // Parse XML and extract text from <w:t> tags
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'application/xml');
        const textNodes = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't');

        const paragraphs: string[] = [];
        let currentParagraph = '';

        // Walk through parent elements to detect paragraph breaks
        const allParagraphNodes = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p');
        for (let i = 0; i < allParagraphNodes.length; i++) {
            const pNode = allParagraphNodes[i];
            const tNodes = pNode.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't');
            currentParagraph = '';
            for (let j = 0; j < tNodes.length; j++) {
                currentParagraph += tNodes[j].textContent || '';
            }
            if (currentParagraph.trim()) {
                paragraphs.push(currentParagraph.trim());
            }
        }

        const result = paragraphs.join('\n');
        console.log(`DOCX extracted: ${result.length} characters from ${paragraphs.length} paragraphs`);
        return result;
    } catch (err) {
        console.warn('DOCX text extraction failed:', err);
        throw err;
    }
}

/**
 * Universal dispatcher: extracts text from PDF (data URI) or DOCX (File).
 * For PDF: pass dataUri string. For DOCX: pass File object.
 */
export async function extractTextFromFile(
    fileOrDataUri: File | string,
    config?: AppConfig,
    fileName?: string,
): Promise<string> {
    if (typeof fileOrDataUri === 'string') {
        return extractTextFromPdf(fileOrDataUri, config);
    }
    const name = (fileName || fileOrDataUri.name || '').toLowerCase();
    console.log(`Universal extractor: processing "${name}"...`);
    if (name.endsWith('.docx') || name.endsWith('.doc')) {
        return extractTextFromDocx(fileOrDataUri);
    }
    // Fallback: try as PDF data URI if it's somehow a File
    const dataUri = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(fileOrDataUri);
    });
    return extractTextFromPdf(dataUri, config);
}

// ─── Local date / validity helpers ───────────────────────────────

const MONTH_PT: Record<string, string> = {
    janeiro: '01', fevereiro: '02', março: '03', 'marco': '03',
    abril: '04', maio: '05', junho: '06', julho: '07',
    agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

/**
 * Converts an ISO date string (YYYY-MM-DD) by adding N months.
 * Clamps to the last valid day of the resulting month.
 */
function addMonthsToIso(isoDate: string, months: number): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    const target = new Date(y, m - 1 + months, d);
    if (target.getDate() !== d) target.setDate(0); // clamp to last day
    return [
        target.getFullYear(),
        String(target.getMonth() + 1).padStart(2, '0'),
        String(target.getDate()).padStart(2, '0'),
    ].join('-');
}

/**
 * Tries to extract the end-of-contract date — the date written in plain text
 * at the bottom of the contract body, before the signature block.
 * Supports Brazilian formats: "Cidade, 20 de fevereiro de 2026.",
 * "Local, 20/02/2026", "aos 20 dias do mês de fevereiro de 2026".
 */
function parseEndOfContractDate(text: string): string | undefined {
    // "Brasília, 20 de fevereiro de 2026" or "São Paulo, 15 de março de 2025"
    const writtenMatch = text.match(
        /[A-ZÀ-Ú][A-Za-zÀ-ú\s\/,]+,\s*(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i,
    );
    if (writtenMatch) {
        const day = writtenMatch[1].padStart(2, '0');
        const month = MONTH_PT[writtenMatch[2].toLowerCase()] || writtenMatch[2];
        return `${writtenMatch[3]}-${month}-${day}`;
    }

    // "aos X dias do mês de Y de ZZZZ"
    const aosMatch = text.match(
        /aos\s+(\d{1,2})\s+(?:\w+\s+)?(?:dias?\s+)?(?:do\s+m[eê]s\s+de\s+)?(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i,
    );
    if (aosMatch) {
        const day = aosMatch[1].padStart(2, '0');
        const month = MONTH_PT[aosMatch[2].toLowerCase()] || aosMatch[2];
        return `${aosMatch[3]}-${month}-${day}`;
    }

    return undefined;
}

/**
 * Extracts the contract validity period and returns it in whole months.
 * Handles: "12 (doze) meses", "1 (um) ano", "24 meses", "3 anos", "36 (trinta e seis) meses".
 */
export function parseVigenciaMeses(text: string): number | undefined {
    // "X meses" after validity keywords
    const monthsMatch = text.match(
        /(?:vig[eê]ncia|prazo|dura[çc][aã]o)\s+(?:de|:)?\s+(\d+)\s*(?:\([^)]+\)\s*)?m[eê]s(?:es)?/i,
    );
    if (monthsMatch) return parseInt(monthsMatch[1], 10);

    // "X ano(s)" after validity keywords
    const yearsMatch = text.match(
        /(?:vig[eê]ncia|prazo|dura[çc][aã]o)\s+(?:de|:)?\s+(\d+)\s*(?:\([^)]+\)\s*)?ano(?:s)?/i,
    );
    if (yearsMatch) return parseInt(yearsMatch[1], 10) * 12;

    return undefined;
}

// ─── Currency helpers ────────────────────────────────────────────

/** Parses a Brazilian money string like "2.000,00" → 2000.00 */
function parseBrMoney(s: string): number {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

/** Formats a number as Brazilian currency string like 2000.00 → "2.000,00" */
function formatBrMoney(n: number): string {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Attempts to parse contract fields from extracted PDF text.
 */
export function parseContractFields(text: string): {
    nomeContrato?: string;
    numero?: string;
    empresa?: string;
    objeto?: string;
    valor?: string;
    dataInicio?: string; // YYYY-MM-DD format for <input type=date>
    dataVencimento?: string;
    vigenciaMeses?: number;
    tipo?: string;
} {
    const result: ReturnType<typeof parseContractFields> = {};
    const t = text.replace(/\s+/g, ' ');

    // ── Contract title (nomeContrato) ────────────────────────────
    // The title is typically in the first 600 characters, all-caps or mixed-case,
    // and contains a keyword like CONTRATO, INSTRUMENTO, TERMO.
    const firstChunk = t.substring(0, 600);
    const titleMatch =
        // "CONTRATO DE PRESTAÇÃO DE SERVIÇOS Nº 001/2026 – OBJETO..."
        firstChunk.match(/\b((?:CONTRATO|INSTRUMENTO\s+PARTICULAR|TERMO\s+DE\s+CONTRATO|ACORDO)\s+[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s\d°º,./\-–]+?)(?=\s*(?:ENTRE\s+AS\s+PARTES|CONTRATANTE|CONTRATADA|PARTES|CLÁUSULA|\d{2}[/.]))/i) ||
        firstChunk.match(/\b((?:contrato|instrumento\s+particular|termo\s+de\s+contrato)\s+(?:de|para|do|da|n[°ºo]\.?|nº)?\s*[^\n.]{5,120})/i);
    if (titleMatch) {
        result.nomeContrato = titleMatch[1].replace(/\s+/g, ' ').trim().replace(/[-–:]+$/, '').trim().substring(0, 150);
    }

    // Contract number patterns
    const numMatch = t.match(/(?:contrato|contrat)\s*(?:n[°ºo.]?\s*|n[úu]mero\s*):?\s*([A-Z0-9/._-]{3,25})/i)
        || t.match(/(?:n[°ºo.]?\s*):?\s*([A-Z]{2,5}[- /.]\d{4}[- /.]\d{2,6}[A-Z]?)/i)
        || t.match(/(?:processo|pregão|licitação)\s*(?:n[°ºo.]?\s*):?\s*([A-Z0-9/._-]{3,25})/i);
    if (numMatch) result.numero = numMatch[1].trim();

    // ── Company / Contratada ──────────────────────────────────────
    // The regex intentionally matches a wide context to locate the company block,
    // but may capture "CONTRATADA:" or "EMPRESA:" label prefixes inside the group.
    // We strip those below.
    const empMatch =
        // "CONTRATADA: ACME Ltda, CNPJ..." or "CONTRATADO: João Silva, CPF..."
        t.match(/\bcontratad[ao]\s*:?\s*(.{5,100}?)(?=\s*,\s*(?:inscrit|CNPJ|CPF|pessoa|com sede|doravante|situa))/i) ||
        // "EMPRESA CONTRATADA: ..." or "EMPRESA: ..."
        t.match(/\bempresa(?:\s+contratad[ao])?\s*:?\s*(.{5,100}?)(?=\s*,\s*(?:inscrit|CNPJ|CPF|pessoa|com sede))/i) ||
        // "RAZÃO SOCIAL: ..."
        t.match(/\braz[ãa]o\s*social\s*:?\s*(.{5,100}?)(?=\s*,?\s*(?:CNPJ|inscrit|pessoa))/i) ||
        // "denominada ACME Ltda" (doravante/denominada patterns)
        t.match(/(?:doravante\s+denominad[ao]|simplesmente\s+denominad[ao])\s+(?:CONTRATAD[AO]\s+)?["""«]?(.{5,80}?)["""»]?(?=\s*[,.]|\s+com\s+sede)/i);

    if (empMatch) {
        let emp = empMatch[1].replace(/^[-–:\s]+/, '').trim();
        // Strip common label prefixes inadvertently captured inside the group
        emp = emp.replace(/^(?:empresa\s+)?contratad[ao]\s*:?\s*/i, '');
        emp = emp.replace(/^(?:empresa|contratante|raz[ãa]o\s+social)\s*:?\s*/i, '');
        result.empresa = emp.trim().substring(0, 80);
    }

    // ── Object ────────────────────────────────────────────────────
    const objMatch =
        t.match(/(?:cl[áa]usula\s+(?:primeira?|1[aª°]?)[\s\S]{0,60}?objeto)[:\s–-]+(.{10,250}?)(?=\s*cl[áa]usula|\s*§|\.\s*[A-Z]|valor\s*:)/i) ||
        t.match(/(?:objeto\s+do\s+contrato|do\s+objeto)\s*[:\s–-]+(.{10,250}?)(?=\s*cl[áa]usula|\s*§|\.\s*[A-Z]|valor\s*:)/i) ||
        t.match(/(?:^|[\n.])objeto\s*:?\s*(.{10,200}?)(?:\.\s*[A-Z]|cl[áa]usula|valor)/im) ||
        t.match(/tem\s+por\s+objeto\s+(.{10,250}?)(?:\.\s*[A-Z]|cl[áa]usula|§|valor\s*:)/i) ||
        t.match(/presente\s+contrato\s+(?:tem|é)\s+(.{10,200}?)(?:\.\s*[A-Z]|cl[áa]usula|§)/i);
    if (objMatch) result.objeto = objMatch[1].replace(/^[-–:\s]+/, '').trim().substring(0, 200);

    // ── Value ─────────────────────────────────────────────────────
    // Try to find implantação + manutenção/mensalidade values separately and sum them.

    const implantacaoMatch = t.match(
        /(?:implanta[çc][aã]o|taxa\s+(?:de\s+)?(?:setup|implanta[çc][aã]o)|ativa[çc][aã]o|setup)\s*[:\s–-]+R\$\s*([\d.,]+)/i,
    );
    const manutencaoMatch = t.match(
        /(?:manuten[çc][aã]o|mensalidade|subscri[çc][aã]o|suporte\s+mensal)\s*[:\s–-]+R\$\s*([\d.,]+)/i,
    );

    if (implantacaoMatch && manutencaoMatch) {
        const total = parseBrMoney(implantacaoMatch[1]) + parseBrMoney(manutencaoMatch[1]);
        result.valor = 'R$ ' + formatBrMoney(total);
    } else {
        // Fallback: find the most specific explicit total/global value
        const valMatch =
            t.match(/valor\s*(?:global|total|do\s+contrato|dos\s+servi[çc]os|contratual)\s*[:\s–-]+R\$\s*([\d.,]+)/i) ||
            t.match(/(?:importância|quantia)\s*(?:global|total|de)?\s*(?:R\$\s*)?([\d.,]+)\s*(?:\(|reais)/i) ||
            t.match(/(?:pagar[áa]|remuneração)\s+(?:[ao]\s+)?(?:valor|quantia)\s+(?:de\s+)?R\$\s*([\d.,]+)/i) ||
            implantacaoMatch ||
            manutencaoMatch ||
            t.match(/R\$\s*([\d.,]+(?:\.\d{3})*,\d{2})\s*(?:\(|\s*(?:mensais?|por\s+m[eê]s|anuais?|reais))/i);
        if (valMatch) result.valor = 'R$ ' + valMatch[1].trim();
    }

    // ── Dates ────────────────────────────────────────────────────

    // 1. Try to find the end-of-contract date (plain-text, before signatures)
    const endDate = parseEndOfContractDate(text);
    if (endDate) result.dataInicio = endDate;

    // 2. Extract validity in months to calculate vencimento
    const vigenciaMeses = parseVigenciaMeses(text);
    if (vigenciaMeses) result.vigenciaMeses = vigenciaMeses;

    // 3. If we have dataInicio + vigência, compute vencimento
    if (result.dataInicio && vigenciaMeses) {
        result.dataVencimento = addMonthsToIso(result.dataInicio, vigenciaMeses);
    }

    // 4. Fallback to DD/MM/YYYY pattern matching
    const dateMatches = [...t.matchAll(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})/g)];
    if (dateMatches.length >= 1) {
        const findDateNear = (keywords: string[]) => {
            for (const match of dateMatches) {
                const index = match.index!;
                const context = t.substring(Math.max(0, index - 150), Math.min(t.length, index + 150));
                if (keywords.some(k => context.toLowerCase().includes(k))) {
                    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
                }
            }
            return null;
        };

        if (!result.dataInicio) {
            result.dataInicio =
                findDateNear(['assinado', 'firmado', 'celebrado', 'assinatura', 'data do contrato']) ||
                findDateNear(['início', 'inicio', 'vigência', 'vigencia', 'partir de']) ||
                `${dateMatches[0][3]}-${dateMatches[0][2].padStart(2, '0')}-${dateMatches[0][1].padStart(2, '0')}`;
        }

        if (!result.dataVencimento) {
            result.dataVencimento =
                findDateNear(['vencimento', 'término', 'termino', 'final', 'até', 'ate', 'expiração']) ||
                (dateMatches.length > 1
                    ? `${dateMatches[dateMatches.length - 1][3]}-${dateMatches[dateMatches.length - 1][2].padStart(2, '0')}-${dateMatches[dateMatches.length - 1][1].padStart(2, '0')}`
                    : undefined);
        }
    }

    // Type — from explicit field or from context
    const tipoMatch = t.match(/(?:tipo|modalidade|natureza)\s*:?\s*(servi[çc]o|fornecimento|obra|locação|consultoria|prestação)/i);
    if (tipoMatch) {
        result.tipo = tipoMatch[1].charAt(0).toUpperCase() + tipoMatch[1].slice(1).toLowerCase();
    } else {
        result.tipo = detectTypeFromText(t);
    }

    return result;
}

/**
 * Detect contract type from text content via keyword analysis
 */
export function detectTypeFromText(text: string): string {
    const t = text.toLowerCase();
    const scores: Record<string, number> = { Serviço: 0, Fornecimento: 0, Obra: 0, Locação: 0, Consultoria: 0, NDA: 0 };
    const keywords: Record<string, string[]> = {
        Serviço: ['prestação de serviço', 'serviço', 'sla', 'manutenção', 'suporte', 'atendimento', 'vigilância', 'limpeza'],
        Fornecimento: ['fornecimento', 'material', 'entrega', 'insumo', 'produto', 'aquisição', 'compra', 'venda'],
        Obra: ['obra', 'construção', 'reforma', 'engenharia', 'medição', 'cronograma físico', 'bloco'],
        Locação: ['locação', 'aluguel', 'locador', 'locatário', 'imóvel', 'reajuste anual', 'aluguer'],
        Consultoria: ['consultoria', 'assessoria', 'diagnóstico', 'parecer', 'relatório técnico', 'estudo'],
        NDA: ['confidencialidade', 'sigilo', 'nda', 'confidencial', 'segredo', 'não divulgação'],
    };
    for (const [tipo, words] of Object.entries(keywords)) {
        for (const w of words) {
            if (t.includes(w)) scores[tipo]++;
        }
    }
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'Serviço';
}

/**
 * Analyzes contract values — extracts and validates monetary amounts.
 */
export function analyzeValues(text: string): {
    valorTotal?: string;
    valorMensal?: string;
    valorParcela?: string;
    valoresEncontrados: string[];
    alertas: string[];
} {
    const valoresEncontrados: string[] = [];
    const alertas: string[] = [];

    // Find all R$ values
    const valRegex = /R\$\s*([\d.,]+(?:\s*(?:mil|milh[õo]es|bilh[õo]es))?)/gi;
    const matches = [...text.matchAll(valRegex)];
    matches.forEach(m => {
        valoresEncontrados.push('R$ ' + m[1].trim());
    });

    // Also match "valor de X" patterns without R$
    const valRegex2 = /valor\s*(?:de|:)?\s*R?\$?\s*([\d.,]+)/gi;
    const matches2 = [...text.matchAll(valRegex2)];
    matches2.forEach(m => {
        const v = 'R$ ' + m[1].trim();
        if (!valoresEncontrados.includes(v)) valoresEncontrados.push(v);
    });

    let valorTotal: string | undefined;
    let valorMensal: string | undefined;
    let valorParcela: string | undefined;

    // Extract total value
    const totalMatch = text.match(/valor\s*(?:total|global|do contrato)\s*(?:[é:]|de)\s*R?\$?\s*([\d.,]+)/i);
    if (totalMatch) valorTotal = 'R$ ' + totalMatch[1].trim();

    // Extract monthly value
    const mensalMatch = text.match(/(?:parcelas?\s*mensais?|valor\s*mensal|aluguel\s*mensal)\s*(?:[é:]|de)\s*R?\$?\s*([\d.,]+)/i);
    if (mensalMatch) valorMensal = 'R$ ' + mensalMatch[1].trim();

    // Installment
    const parcelaMatch = text.match(/(\d+)\s*parcelas?\s*(?:de|no valor de)\s*R?\$?\s*([\d.,]+)/i);
    if (parcelaMatch) valorParcela = `${parcelaMatch[1]}x R$ ${parcelaMatch[2].trim()}`;

    // Value analysis alerts
    if (valoresEncontrados.length === 0) {
        alertas.push('⚡ Nenhum valor monetário identificado no contrato');
    }
    if (valoresEncontrados.length > 5) {
        alertas.push('ℹ️ Múltiplos valores identificados — verifique qual é o valor principal');
    }

    // Check for very high values
    const numericTotal = parseFloat((valorTotal || valoresEncontrados[0] || '0').replace(/[R$\s.]/g, '').replace(',', '.'));
    if (numericTotal > 10000000) {
        alertas.push('⚠️ Valor acima de R$ 10 milhões — requer atenção especial');
    }

    return { valorTotal, valorMensal, valorParcela, valoresEncontrados, alertas };
}

/**
 * Auto-generate contract number in FAP-YYYY-NNNN format.
 */
export function generateContractNumber(existingNumbers: string[]): string {
    const year = new Date().getFullYear();
    const prefix = `FAP-${year}-`;
    const existing = existingNumbers
        .filter(n => n.startsWith(prefix))
        .map(n => parseInt(n.replace(prefix, ''), 10))
        .filter(n => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return `${prefix}${next.toString().padStart(4, '0')}`;
}

/**
 * Local AI simulation: analyzes text for abusive clauses and missing signatures.
 */
export function analyzeContract(text: string): {
    hasAbusiveClauses: boolean;
    missingSignature: boolean;
    findings: string[];
} {
    const findings: string[] = [];
    const t = text.toLowerCase();

    // Abusive clause detection patterns
    const abusivePatterns = [
        { regex: /multa\s*(?:de\s*)?\d+%/i, desc: 'Multa percentual potencialmente abusiva' },
        { regex: /renúncia\s*(?:de|ao|irrevogável).*direito/i, desc: 'Cláusula de renúncia de direitos' },
        { regex: /foro\s*(?:de|da)\s*[a-záàâãéèêíïóôõöúçñ\s]+(?:exclusiv|irrevogável)/i, desc: 'Foro exclusivo potencialmente restritivo' },
        { regex: /reajuste\s*(?:automático|unilateral)/i, desc: 'Reajuste unilateral/automático' },
        { regex: /penalidade\s*(?:de\s*)?\d+%/i, desc: 'Penalidade percentual elevada' },
        { regex: /rescisão\s*(?:unilateral|imotivada|sem\s*aviso)/i, desc: 'Cláusula de rescisão unilateral' },
        { regex: /responsabilidade\s*(?:ilimitada|integral|total)\s*(?:do|da)\s*contratad/i, desc: 'Responsabilidade ilimitada da contratada' },
        { regex: /renovação\s*automática\s*(?:por\s*prazo)?/i, desc: 'Renovação automática sem consentimento explícito' },
        { regex: /prazo\s*(?:indeterminado|ilimitado)/i, desc: 'Prazo indeterminado pode ser abusivo' },
        { regex: /exclusividade\s*(?:de|do|da)/i, desc: 'Cláusula de exclusividade' },
    ];

    const hasAbusiveClauses = abusivePatterns.some(p => {
        if (p.regex.test(text)) {
            findings.push(`⚠️ ${p.desc}`);
            return true;
        }
        return false;
    });
    // Check all remaining patterns too
    abusivePatterns.forEach(p => {
        if (p.regex.test(text) && !findings.includes(`⚠️ ${p.desc}`)) {
            findings.push(`⚠️ ${p.desc}`);
        }
    });

    // Missing signature detection
    const signatureTerms = ['assinatura', 'assinado', 'firmado', 'subscrit', 'testemunha'];
    const hasSignature = signatureTerms.some(term => t.includes(term));
    const missingSignature = !hasSignature;

    if (missingSignature) {
        findings.push('🔴 Assinatura não identificada no documento');
    }

    // Additional checks
    if (!t.includes('vigência') && !t.includes('prazo')) {
        findings.push('⚡ Prazo de vigência não identificado');
    }
    if (!t.includes('valor') && !t.includes('r$')) {
        findings.push('⚡ Valor do contrato não identificado');
    }
    if (t.length < 100) {
        findings.push('⚡ Documento com pouco conteúdo textual — pode ser imagem/scan');
    }

    return { hasAbusiveClauses, missingSignature, findings };
}
