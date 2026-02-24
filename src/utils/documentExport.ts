import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";

/**
 * Detects if a line is a contract title (first heading, all caps)
 */
function isContractTitle(line: string, index: number, allLines: Array<{ text: string }>): boolean {
  const trimmed = line.trim();
  if (index > 3) return false; // Only first few lines can be the title
  return /^(CONTRAT|ACORDO|TERMO|INSTRUMENTO)/i.test(trimmed)
    && trimmed.length > 10
    && trimmed === trimmed.toUpperCase();
}

/**
 * Detects if a line is a clause heading (CLÁUSULA PRIMEIRA, etc.)
 */
function isClauseHeading(line: string): boolean {
  const trimmed = line.trim();
  return /^CL[ÁA]USULA\s+/i.test(trimmed);
}

/**
 * Detects if a line is a section heading (DAS OBRIGAÇÕES, DO OBJETO, etc.)
 */
function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  // All uppercase lines that look like headings but aren't clauses
  if (/^(CONTRATANTE|CONTRATADA|LOCADOR|LOCATÁRIO|PARTE\s)/i.test(trimmed)) return false;
  return (
    /^(DAS |DOS |DO |DA |CAPÍTULO|SEÇÃO|TÍTULO|ANEXO)/i.test(trimmed) ||
    (/^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\d\s.–\-:]{5,80}$/.test(trimmed) && trimmed === trimmed.toUpperCase() && trimmed.length > 5 && !isSeparator(trimmed) && !isPartyLine(trimmed))
  );
}

function isHeading(line: string): boolean {
  return isClauseHeading(line) || isSectionHeading(line);
}

function isSeparator(line: string): boolean {
  return /^[_\-=]{3,}$/.test(line.trim());
}

function isListItem(line: string): boolean {
  return /^\s*(?:[a-z]\)|[ivxlcdm]+\)|[0-9]+[.)]\s|\u2022|\u25CF|\u25CB|[-–•]\s)/.test(line);
}

function isPartyLine(line: string): boolean {
  return /^(CONTRATANTE|CONTRATADA|LOCADOR|LOCATÁRIO|PARTE\s|TESTEMUNHA)/i.test(line.trim());
}

function isSignatureLine(line: string): boolean {
  return /^_{3,}/.test(line.trim()) || isPartyLine(line);
}

type BlockType = 'title' | 'clause-heading' | 'section-heading' | 'body' | 'separator' | 'list' | 'empty' | 'party-info' | 'signature';

interface TextBlock {
  text: string;
  type: BlockType;
}

/**
 * Groups raw text lines into logical blocks preserving the original structure.
 * Each clause stays separate, party info stays on its own line.
 */
function groupIntoParagraphs(text: string): TextBlock[] {
  const rawLines = text.split(/\n/);
  const groups: TextBlock[] = [];

  let currentBody: string[] = [];

  const flushBody = () => {
    if (currentBody.length > 0) {
      groups.push({ text: currentBody.join(' '), type: 'body' });
      currentBody = [];
    }
  };

  for (let idx = 0; idx < rawLines.length; idx++) {
    const line = rawLines[idx].trimEnd();

    if (!line.trim()) {
      flushBody();
      if (groups.length === 0 || groups[groups.length - 1].type !== 'empty') {
        groups.push({ text: '', type: 'empty' });
      }
      continue;
    }

    if (isSeparator(line)) {
      flushBody();
      groups.push({ text: line, type: 'separator' });
      continue;
    }

    if (isContractTitle(line, groups.filter(g => g.type !== 'empty').length, groups)) {
      flushBody();
      groups.push({ text: line.trim(), type: 'title' });
      continue;
    }

    if (isClauseHeading(line)) {
      flushBody();
      groups.push({ text: line.trim(), type: 'clause-heading' });
      continue;
    }

    if (isSectionHeading(line)) {
      flushBody();
      groups.push({ text: line.trim(), type: 'section-heading' });
      continue;
    }

    if (isSignatureLine(line)) {
      flushBody();
      groups.push({ text: line.trim(), type: 'signature' });
      continue;
    }

    // Party info lines (CONTRATANTE: ..., CONTRATADA: ...)
    if (/^(CONTRATANTE|CONTRATADA|LOCADOR|LOCATÁRIO|PARTE\s)/i.test(line.trim())) {
      flushBody();
      groups.push({ text: line.trim(), type: 'party-info' });
      continue;
    }

    if (isListItem(line)) {
      flushBody();
      groups.push({ text: line.trim(), type: 'list' });
      continue;
    }

    // Regular body line — accumulate into current paragraph
    currentBody.push(line.trim());
  }

  flushBody();
  return groups;
}

// ─── PDF Export ─────────────────────────────────────────────────

export function downloadAsPdf(content: string, fileName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  const maxWidth = pageWidth - margin * 2;
  let y = 30;

  const groups = groupIntoParagraphs(content);

  // Font sizes matching professional contract formatting
  const FONT_SIZE = {
    title: 14,
    clauseHeading: 11,
    sectionHeading: 11,
    body: 10.5,
    list: 10.5,
    partyInfo: 10.5,
    signature: 10,
  };

  const LINE_HEIGHT = {
    title: 7,
    clauseHeading: 6,
    sectionHeading: 6,
    body: 5,
    list: 5,
    partyInfo: 5.5,
    signature: 5,
  };

  for (const group of groups) {
    if (group.type === 'empty') {
      y += 4;
      continue;
    }

    if (group.type === 'separator') {
      if (y > 275) { doc.addPage(); y = 25; }
      doc.setDrawColor(150);
      doc.setLineWidth(0.3);
      doc.line(margin + 20, y, pageWidth - margin - 20, y);
      y += 8;
      continue;
    }

    let fontSize: number;
    let lineHeight: number;
    let fontStyle: string;
    let textIndent = 0;

    switch (group.type) {
      case 'title':
        fontSize = FONT_SIZE.title;
        lineHeight = LINE_HEIGHT.title;
        fontStyle = 'bold';
        y += 4; // Extra space before title
        break;
      case 'clause-heading':
        fontSize = FONT_SIZE.clauseHeading;
        lineHeight = LINE_HEIGHT.clauseHeading;
        fontStyle = 'bold';
        y += 6; // Extra space before each clause
        break;
      case 'section-heading':
        fontSize = FONT_SIZE.sectionHeading;
        lineHeight = LINE_HEIGHT.sectionHeading;
        fontStyle = 'bold';
        y += 3;
        break;
      case 'party-info':
        fontSize = FONT_SIZE.partyInfo;
        lineHeight = LINE_HEIGHT.partyInfo;
        fontStyle = 'normal';
        break;
      case 'list':
        fontSize = FONT_SIZE.list;
        lineHeight = LINE_HEIGHT.list;
        fontStyle = 'normal';
        textIndent = 5;
        break;
      case 'signature':
        fontSize = FONT_SIZE.signature;
        lineHeight = LINE_HEIGHT.signature;
        fontStyle = 'normal';
        y += 2;
        break;
      default: // body
        fontSize = FONT_SIZE.body;
        lineHeight = LINE_HEIGHT.body;
        fontStyle = 'normal';
        break;
    }

    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);

    const textMargin = margin + textIndent;
    const textWidth = maxWidth - textIndent;

    // For title, center it
    if (group.type === 'title') {
      const wrapped = doc.splitTextToSize(group.text, textWidth) as string[];
      for (const wl of wrapped) {
        if (y > 275) { doc.addPage(); y = 25; }
        const textW = doc.getTextWidth(wl);
        const centerX = (pageWidth - textW) / 2;
        doc.text(wl, centerX, y);
        y += lineHeight;
      }
      y += 4; // Space after title
      continue;
    }

    // For clause headings, add a subtle left accent
    if (group.type === 'clause-heading') {
      if (y > 275) { doc.addPage(); y = 25; }
      // Draw a small accent line on the left
      doc.setDrawColor(60, 60, 180);
      doc.setLineWidth(0.8);
      doc.line(margin - 2, y - 3, margin - 2, y + 2);
      doc.setDrawColor(0);
    }

    const wrapped = doc.splitTextToSize(group.text, textWidth) as string[];
    for (const wl of wrapped) {
      if (y > 275) { doc.addPage(); y = 25; }
      doc.text(wl, textMargin, y);
      y += lineHeight;
    }

    // Spacing after blocks
    switch (group.type) {
      case 'clause-heading':
        y += 2;
        break;
      case 'section-heading':
        y += 2;
        break;
      case 'body':
        y += 3;
        break;
      case 'list':
        y += 1;
        break;
      case 'signature':
        y += 4;
        break;
      default:
        y += 2;
    }
  }

  doc.save(`${fileName}.pdf`);
}

// ─── DOCX Export ────────────────────────────────────────────────

export async function downloadAsDocx(content: string, fileName: string) {
  const groups = groupIntoParagraphs(content);
  const paragraphs: Paragraph[] = [];

  // Consistent font settings matching professional contracts
  const FONT_NAME = "Arial";
  const FONT_SIZE = {
    title: 28,        // 14pt
    clauseHeading: 24, // 12pt
    sectionHeading: 24, // 12pt
    body: 22,          // 11pt
    list: 22,          // 11pt
    partyInfo: 22,     // 11pt
    signature: 20,     // 10pt
  };

  for (const group of groups) {
    if (group.type === 'empty') {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 80 } }));
      continue;
    }

    if (group.type === 'separator') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: "________________________________________", font: FONT_NAME, size: 20, color: "888888" })],
        spacing: { before: 240, after: 240 },
        alignment: AlignmentType.CENTER,
      }));
      continue;
    }

    if (group.type === 'title') {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 240 },
        children: [
          new TextRun({
            text: group.text,
            bold: true,
            font: FONT_NAME,
            size: FONT_SIZE.title,
          }),
        ],
      }));
      continue;
    }

    if (group.type === 'clause-heading') {
      paragraphs.push(new Paragraph({
        spacing: { before: 360, after: 120 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 6, color: "3B3BBA", space: 8 },
        },
        children: [
          new TextRun({
            text: group.text,
            bold: true,
            font: FONT_NAME,
            size: FONT_SIZE.clauseHeading,
          }),
        ],
      }));
      continue;
    }

    if (group.type === 'section-heading') {
      paragraphs.push(new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({
            text: group.text,
            bold: true,
            font: FONT_NAME,
            size: FONT_SIZE.sectionHeading,
          }),
        ],
      }));
      continue;
    }

    if (group.type === 'party-info') {
      // Split on ":" to bold the label part
      const colonIdx = group.text.indexOf(':');
      if (colonIdx > 0) {
        const label = group.text.substring(0, colonIdx + 1);
        const value = group.text.substring(colonIdx + 1);
        paragraphs.push(new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: label, bold: true, font: FONT_NAME, size: FONT_SIZE.partyInfo }),
            new TextRun({ text: value, font: FONT_NAME, size: FONT_SIZE.partyInfo }),
          ],
        }));
      } else {
        paragraphs.push(new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: group.text, bold: true, font: FONT_NAME, size: FONT_SIZE.partyInfo }),
          ],
        }));
      }
      continue;
    }

    if (group.type === 'list') {
      paragraphs.push(new Paragraph({
        spacing: { before: 40, after: 40, line: 276 },
        indent: { left: 720 }, // 0.5 inch
        children: [
          new TextRun({
            text: group.text,
            font: FONT_NAME,
            size: FONT_SIZE.list,
          }),
        ],
      }));
      continue;
    }

    if (group.type === 'signature') {
      paragraphs.push(new Paragraph({
        spacing: { before: 200, after: 60 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: group.text,
            font: FONT_NAME,
            size: FONT_SIZE.signature,
          }),
        ],
      }));
      continue;
    }

    // Body text — justified, consistent line spacing
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: {
        before: 40,
        after: 100,
        line: 300, // 1.25 line spacing for readability
      },
      children: [
        new TextRun({
          text: group.text,
          font: FONT_NAME,
          size: FONT_SIZE.body,
        }),
      ],
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileName}.docx`);
}
