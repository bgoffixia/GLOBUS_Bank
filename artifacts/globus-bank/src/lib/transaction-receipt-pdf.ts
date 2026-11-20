import type { ReceiptTemplate } from '@workspace/api-client-react';

export interface TransactionReceiptPdfData {
  reference: string;
  receiptTemplate?: ReceiptTemplate;
  amount: string;
  status: string;
  date: string;
  description: string;
  counterparty: string;
  activity: string;
  sourceAmount?: string;
  exchangeRate?: string;
  convertedAmount?: string;
  senderName?: string;
  senderWallet?: string;
  recipient?: string;
  recipientBank?: string;
  recipientCountry?: string;
  recipientAccount?: string;
  routingNumber?: string;
  swiftBic?: string;
  remark?: string;
  route?: string;
  fee?: string;
}

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_MARGIN = 104;
const TEXT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The Globus logo could not be loaded.'));
    image.src = src;
  });
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const parts = context.measureText(word).width > maxWidth ? Array.from(word) : [word];
    for (const part of parts) {
      const candidate = line ? `${line}${parts.length > 1 ? '' : ' '}${part}` : part;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = part;
      } else {
        line = candidate;
      }
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function concatBytes(chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function createPdfFromJpeg(imageBytes: Uint8Array) {
  const encoder = new TextEncoder();
  const content = encoder.encode('q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n');
  const objects: Uint8Array[] = [
    encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    encoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encoder.encode('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),
    concatBytes([
      encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH} /Height ${PAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`),
      imageBytes,
      encoder.encode('\nendstream'),
    ]),
    concatBytes([
      encoder.encode(`<< /Length ${content.length} >>\nstream\n`),
      content,
      encoder.encode('endstream'),
    ]),
  ];
  const chunks: Uint8Array[] = [encoder.encode('%PDF-1.4\n')];
  const offsets = [0];
  let byteOffset = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(byteOffset);
    const wrappedObject = concatBytes([
      encoder.encode(`${index + 1} 0 obj\n`),
      object,
      encoder.encode('\nendobj\n'),
    ]);
    chunks.push(wrappedObject);
    byteOffset += wrappedObject.length;
  });

  const xrefOffset = byteOffset;
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');
  chunks.push(encoder.encode(xref));
  return new Blob([concatBytes(chunks)], { type: 'application/pdf' });
}

function drawReceipt(context: CanvasRenderingContext2D, logo: HTMLImageElement, receipt: TransactionReceiptPdfData) {
  const template = receipt.receiptTemplate ?? 'standard';
  const left = PAGE_MARGIN;
  const right = PAGE_WIDTH - PAGE_MARGIN;
  const contentWidth = right - left;
  const pageBackground = template === 'journey' ? '#e8f0ec' : template === 'ledger' ? '#e9efea' : '#f3f6f7';
  const paperBackground = template === 'statement' ? '#fcfcf7' : template === 'ledger' ? '#fbfcf7' : '#fffefa';
  context.fillStyle = pageBackground;
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  drawRoundedRect(context, left - 22, 52, contentWidth + 44, PAGE_HEIGHT - 104, template === 'statement' ? 2 : 26);
  context.fillStyle = paperBackground;
  context.fill();
  context.strokeStyle = '#dce5e8';
  context.lineWidth = 2;
  context.stroke();

  const logoHeight = 66;
  const logoWidth = Math.min(370, logo.naturalWidth / logo.naturalHeight * logoHeight);
  context.drawImage(logo, left, 88, logoWidth, logoHeight);

  const completed = receipt.status.toLowerCase() === 'completed';
  const statusText = completed ? 'RECORDED' : receipt.status.toUpperCase();
  context.font = '700 18px Arial, sans-serif';
  const statusWidth = context.measureText(statusText).width + 34;
  drawRoundedRect(context, right - statusWidth, 102, statusWidth, 38, 19);
  context.fillStyle = completed ? '#eff7f2' : '#fbf7eb';
  context.fill();
  context.fillStyle = completed ? '#47755f' : '#8b7440';
  context.textBaseline = 'middle';
  context.fillText(statusText, right - statusWidth + 17, 121);
  context.textBaseline = 'alphabetic';

  context.strokeStyle = '#e6ecee';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(left, 180);
  context.lineTo(right, 180);
  context.stroke();

  context.fillStyle = '#478783';
  context.font = '700 19px Arial, sans-serif';
  context.fillText(
    template === 'statement'
      ? 'PAYMENTS & SETTLEMENTS · INTERNAL RECORD'
      : template === 'journey'
        ? 'TRANSFER JOURNEY · GLOBUS LEDGER'
        : template === 'ledger'
          ? 'GLOBUS LEDGER · TRANSFER RECORD'
          : 'GLOBUS BANK · TRANSACTION RECORD',
    left,
    232,
  );
  context.fillStyle = '#183450';
  context.font = '700 48px Arial, sans-serif';
  const title = {
    standard: 'Payment receipt',
    bank_grade: 'Bank transaction record',
    journey: 'Transfer journey',
    ledger: 'Transfer ledger',
    statement: 'Transaction statement',
  }[template];
  context.fillText(title, left, 292);
  context.fillStyle = '#7d8d9b';
  context.font = '400 23px Arial, sans-serif';
  const activityLines = wrapText(context, receipt.activity, contentWidth);
  activityLines.slice(0, 2).forEach((line, index) => context.fillText(line, left, 330 + index * 31));

  const heroY = 370 + (Math.min(activityLines.length, 2) - 1) * 30;
  const heroHeight = receipt.sourceAmount && receipt.convertedAmount ? 310 : 215;
  drawRoundedRect(context, left, heroY, contentWidth, heroHeight, 24);
  const darkHero = template === 'standard' || template === 'bank_grade';
  context.fillStyle = darkHero ? '#173858' : template === 'journey' ? '#f5f8f4' : template === 'ledger' ? '#eff4ed' : '#f1f5ef';
  context.fill();

  context.fillStyle = darkHero ? '#a9d6d3' : '#718b81';
  context.font = '700 18px Arial, sans-serif';
  context.fillText('TRANSACTION AMOUNT', left + 34, heroY + 48);
  context.fillStyle = darkHero ? '#ffffff' : '#203f49';
  context.font = '700 58px Arial, sans-serif';
  context.fillText(receipt.amount, left + 34, heroY + 116);

  if (receipt.sourceAmount && receipt.convertedAmount) {
    context.strokeStyle = darkHero ? 'rgba(255,255,255,.18)' : '#dbe5df';
    context.beginPath();
    context.moveTo(left + 34, heroY + 144);
    context.lineTo(right - 34, heroY + 144);
    context.stroke();

    const halfWidth = (contentWidth - 96) / 2;
    context.fillStyle = darkHero ? '#a9c0d1' : '#82928e';
    context.font = '700 16px Arial, sans-serif';
    context.fillText('SOURCE AMOUNT', left + 34, heroY + 180);
    context.fillText('CONVERTED TOTAL', left + 34 + halfWidth + 28, heroY + 180);
    context.fillStyle = darkHero ? '#ffffff' : '#203f49';
    context.font = '600 25px Arial, sans-serif';
    context.fillText(receipt.sourceAmount, left + 34, heroY + 218);
    context.textAlign = 'right';
    context.fillText(receipt.convertedAmount, right - 34, heroY + 218);
    context.textAlign = 'left';

    if (receipt.exchangeRate) {
      context.fillStyle = darkHero ? '#c2d2dd' : '#71868a';
      context.font = '400 18px Arial, sans-serif';
      context.fillText(`Rate: ${receipt.exchangeRate}`, left + 34, heroY + 270);
    }
  }

  let y = heroY + heroHeight + 40;

  if (template === 'journey') {
    context.fillStyle = '#718599';
    context.font = '700 18px Arial, sans-serif';
    context.fillText('TRANSFER JOURNEY', left, y);
    y += 24;
    const journeySteps = [
      ['Request recorded', receipt.date],
      ['Destination details recorded', receipt.recipientBank ? `${receipt.recipientBank}${receipt.recipientCountry ? ` · ${receipt.recipientCountry}` : ''}` : receipt.counterparty],
      ['Globus status', completed ? 'Recorded in Globus ledger' : receipt.status.toLowerCase() === 'pending' ? 'Awaiting administrator review' : 'No wallet balance change'],
    ];
    journeySteps.forEach(([label, value], index) => {
      context.fillStyle = index === 2 && completed ? '#e7f1e8' : '#f1f5f0';
      drawRoundedRect(context, left, y, contentWidth, 64, 12);
      context.fill();
      context.fillStyle = '#397b72';
      context.beginPath();
      context.arc(left + 28, y + 32, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = '700 14px Arial, sans-serif';
      context.fillText(String(index + 1), left + 23, y + 37);
      context.fillStyle = '#344e5c';
      context.font = '700 16px Arial, sans-serif';
      context.fillText(label, left + 54, y + 27);
      context.fillStyle = '#71868a';
      context.font = '400 14px Arial, sans-serif';
      wrapText(context, value || 'Not available', contentWidth - 80).slice(0, 1).forEach(line => context.fillText(line, left + 54, y + 48));
      y += 76;
    });
    y += 4;
  } else if (template === 'ledger') {
    context.fillStyle = '#718599';
    context.font = '700 18px Arial, sans-serif';
    context.fillText('LEDGER ENTRIES', left, y);
    y += 28;
    const entries = [
      ['Transfer request', receipt.amount],
      ...(receipt.convertedAmount ? [['Conversion reference', receipt.convertedAmount]] : []),
      ['Posting status', completed ? 'Recorded in Globus ledger' : receipt.status.toLowerCase() === 'pending' ? 'No balance change while review is pending' : 'No wallet balance change'],
    ];
    entries.forEach(([label, value]) => {
      context.strokeStyle = '#dce6df';
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.stroke();
      y += 30;
      context.fillStyle = '#38545a';
      context.font = '700 16px Arial, sans-serif';
      context.fillText(label, left, y);
      context.textAlign = 'right';
      context.font = '600 15px Arial, sans-serif';
      context.fillText(value, right, y);
      context.textAlign = 'left';
      y += 24;
    });
    y += 8;
  } else if (template === 'bank_grade' && receipt.recipient) {
    context.fillStyle = '#718599';
    context.font = '700 18px Arial, sans-serif';
    context.fillText('RECIPIENT DETAILS ON RECORD', left, y);
    y += 26;
    drawRoundedRect(context, left, y, contentWidth, 86, 14);
    context.fillStyle = '#f5f8f7';
    context.fill();
    context.fillStyle = '#28444c';
    context.font = '700 19px Arial, sans-serif';
    context.fillText(receipt.recipient, left + 20, y + 32);
    context.fillStyle = '#71868a';
    context.font = '400 15px Arial, sans-serif';
    context.fillText([receipt.recipientBank, receipt.recipientCountry].filter(Boolean).join(' · '), left + 20, y + 58);
    y += 110;
  } else if (template === 'statement') {
    context.fillStyle = '#718b81';
    context.font = '700 16px Arial, sans-serif';
    context.fillText(`01  RECORD STATUS · ${completed ? 'RECORDED IN GLOBUS' : receipt.status.toUpperCase()}`, left, y);
    y += 35;
  }

  context.fillStyle = '#718599';
  context.font = '700 18px Arial, sans-serif';
  context.fillText('TRANSACTION DETAILS', left, y);
  y += 24;

  const fields: Array<[string, string | undefined]> = [
    ['Reference', receipt.reference],
    ['Date and time', receipt.date],
    ['Sender', receipt.senderName],
    ['Source wallet', receipt.senderWallet],
    ['Destination bank', receipt.recipientBank],
    ['Country', receipt.recipientCountry],
    ['Recipient account / IBAN', receipt.recipientAccount],
    ['Recipient name', receipt.recipient],
    ['Routing number', receipt.routingNumber],
    ['SWIFT / BIC', receipt.swiftBic],
    ['Remark / description', receipt.remark ?? receipt.description],
    ['Counterparty', receipt.recipient ? undefined : receipt.counterparty],
    ['Fee', receipt.recipient ? undefined : receipt.fee],
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    context.strokeStyle = '#e9edf0';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    y += 32;

    context.fillStyle = '#8291a0';
    context.font = '500 18px Arial, sans-serif';
    context.fillText(label, left, y);

    context.fillStyle = label === 'Reference' ? '#246d69' : '#344b63';
    context.font = label === 'Reference' ? '700 19px monospace' : '600 19px Arial, sans-serif';
    const valueLines = wrapText(context, value, contentWidth - 250);
    valueLines.slice(0, label === 'Description' ? 3 : 2).forEach((line, index) => {
      context.textAlign = 'right';
      context.fillText(line, right, y + index * 26);
    });
    context.textAlign = 'left';
    y += Math.max(40, Math.min(valueLines.length, label === 'Description' ? 3 : 2) * 26) + 12;
  }

  const footerY = Math.min(Math.max(y + 22, PAGE_HEIGHT - 132), PAGE_HEIGHT - 76);
  context.strokeStyle = '#dfe6e9';
  context.setLineDash([6, 6]);
  context.beginPath();
  context.moveTo(left, footerY - 26);
  context.lineTo(right, footerY - 26);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = '#4a826d';
  context.font = '700 18px Arial, sans-serif';
  context.fillText('GLOBUS BANK', left, footerY + 5);
  context.fillStyle = '#7d8c98';
  context.font = '400 17px Arial, sans-serif';
  context.textAlign = 'right';
  context.fillText(
    'Internal Globus ledger record · no outside bank settlement confirmed',
    right,
    footerY + 5,
  );
  context.textAlign = 'left';
}

export async function downloadTransactionReceiptPdf(
  receipt: TransactionReceiptPdfData,
  logoUrl: string,
) {
  const canvas = await renderReceiptCanvas(receipt, logoUrl);
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('The PDF receipt could not be created.')),
      'image/jpeg',
      0.96,
    );
  });
  const pdf = createPdfFromJpeg(new Uint8Array(await jpeg.arrayBuffer()));
  downloadBlob(pdf, receipt.reference, 'pdf');
}

export async function saveTransactionReceiptPng(
  receipt: TransactionReceiptPdfData,
  logoUrl: string,
) {
  const canvas = await renderReceiptCanvas(receipt, logoUrl);
  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('The PNG receipt could not be created.')),
      'image/png',
    );
  });
  const safeReference = receipt.reference.replace(/[^a-z0-9_-]+/gi, '-');
  const file = new File([png], `globus-receipt-${safeReference}.png`, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Globus transaction receipt' });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Fall back to a standard image download when the device share sheet is unavailable.
    }
  }
  downloadBlob(png, receipt.reference, 'png');
}

async function renderReceiptCanvas(receipt: TransactionReceiptPdfData, logoUrl: string) {
  const logo = await loadImage(logoUrl);
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Receipt image generation is not available in this browser.');
  drawReceipt(context, logo, receipt);
  return canvas;
}

function downloadBlob(blob: Blob, reference: string, extension: 'pdf' | 'png') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeReference = reference.replace(/[^a-z0-9_-]+/gi, '-');
  link.href = url;
  link.download = `globus-receipt-${safeReference}.${extension}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
