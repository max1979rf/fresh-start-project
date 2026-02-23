import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopPosition, TabStopType } from "docx";
import { saveAs } from "file-saver";

/**
 * Detects if a line is a title/heading (cláusula, contrato header, etc.)
 */
function isHeading(line: string): boolean {
  const trimmed = line.trim();
  return /^(CONTRAT|ACORDO|TERMO|CLÁUSULA|CAPÍTULO|SEÇÃO|TÍTULO|ANEXO|PARÁGRAFO|DAS |DOS |DO |DA )/i.test(trimmed)
    || /^(CL[ÁA]USULA\s+\w+)/i.test(trimmed)
    || (/^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\d\s.–\-:]{5,80}$/.test(trimmed) && trimmed === trimmed.toUpperCase() && trimmed.length > 5);
}

function isSeparator(line: string): boolean {
  return /^[_\-=]{3,}$/.test(line.trim());
}

function isListItem(line: string): boolean {
  return /^\s*(?:[a-z]\)|[ivxlcdm]+\)|[0-9]+[.)]\s|\u2022|\u25CF|\u25CB|[-–•]\s)/.test(line);
}

/**
 * Groups raw text lines into logical blocks (paragraphs, headings, lists).
 * Consecutive non-empty, non-heading lines are merged into a single paragraph.
 */
function groupIntoParagraphs(text: string): Array<{ text: string; type: 'heading' | 'body' | 'separator' | 'list' | 'empty' }> {
  const rawLines = text.split(/\n/);
  const groups: Array<{ text: string; type: 'heading' | 'body' | 'separator' | 'list' | 'empty' }> = [];

  let currentBody: string[] = [];

  const flushBody = () => {
    if (currentBody.length > 0) {
      groups.push({ text: currentBody.join(' '), type: 'body' });
      currentBody = [];
    }
  };

  for (const raw of rawLines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushBody();
      // Only add empty if the last group wasn't already empty
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

    if (isHeading(line)) {
      flushBody();
      groups.push({ text: line.trim(), type: 'heading' });
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

export function downloadAsPdf(content: string, fileName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 25;

  const groups = groupIntoParagraphs(content);

  for (const group of groups) {
    if (group.type === 'empty') {
      y += 3;
      continue;
    }

    if (group.type === 'separator') {
      y += 6;
      continue;
    }

    const isTitle = group.type === 'heading';
    const isList = group.type === 'list';

    doc.setFont("helvetica", isTitle ? "bold" : "normal");
    doc.setFontSize(isTitle ? 12 : 10);

    const textMargin = isList ? margin + 5 : margin;
    const textWidth = isList ? maxWidth - 5 : maxWidth;
    const wrapped = doc.splitTextToSize(group.text, textWidth) as string[];

    for (const wl of wrapped) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(wl, textMargin, y);
      y += isTitle ? 6 : 5;
    }

    // Add spacing after paragraphs
    y += isTitle ? 3 : 2;
  }

  doc.save(`${fileName}.pdf`);
}

export async function downloadAsDocx(content: string, fileName: string) {
  const groups = groupIntoParagraphs(content);
  const paragraphs: Paragraph[] = [];

  for (const group of groups) {
    if (group.type === 'empty') {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 60 } }));
      continue;
    }

    if (group.type === 'separator') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: "________________________________________", font: "Arial", size: 20, color: "999999" })],
        spacing: { before: 200, after: 200 },
        alignment: AlignmentType.CENTER,
      }));
      continue;
    }

    const isTitle = group.type === 'heading';
    const isList = group.type === 'list';

    paragraphs.push(new Paragraph({
      heading: isTitle ? HeadingLevel.HEADING_2 : undefined,
      alignment: isTitle ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: {
        before: isTitle ? 200 : 0,
        after: isTitle ? 120 : 80,
        line: 276, // 1.15 line spacing
      },
      indent: isList ? { left: 720 } : undefined, // 0.5 inch indent for list items
      children: [
        new TextRun({
          text: group.text,
          bold: isTitle,
          font: "Arial",
          size: isTitle ? 24 : 22,
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
