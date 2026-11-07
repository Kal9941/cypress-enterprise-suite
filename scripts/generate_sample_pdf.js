const fs = require('fs');
const path = require('path');

function createValidPdf(filePath) {
  const contentStream = 
`BT
/F1 24 Tf
50 720 Td
(OmniCare Web - Documento E2E) Tj
/F1 14 Tf
0 -40 Td
(Este documento PDF contem conteudo real e visualizavel.) Tj
0 -30 Td
(Validacao de Envio de Anexos no Chat - WhatsApp Oficial.) Tj
0 -30 Td
(Data de Emissao: ${new Date().toLocaleDateString('pt-BR')}) Tj
ET`;

  const streamLength = Buffer.byteLength(contentStream, 'utf-8');

  let pdf = '';
  const offsets = [];

  pdf += '%PDF-1.4\n';

  // Obj 1: Catalog
  offsets.push(Buffer.byteLength(pdf, 'utf-8'));
  pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

  // Obj 2: Pages
  offsets.push(Buffer.byteLength(pdf, 'utf-8'));
  pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

  // Obj 3: Page
  offsets.push(Buffer.byteLength(pdf, 'utf-8'));
  pdf += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';

  // Obj 4: Content Stream
  offsets.push(Buffer.byteLength(pdf, 'utf-8'));
  pdf += `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`;

  // Obj 5: Font
  offsets.push(Buffer.byteLength(pdf, 'utf-8'));
  pdf += '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  // Xref
  const startXref = Buffer.byteLength(pdf, 'utf-8');
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  }

  // Trailer
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  fs.writeFileSync(filePath, pdf, 'utf-8');
  console.log(`PDF criado com sucesso em: ${filePath}`);
}

createValidPdf(path.resolve(__dirname, '../cypress/fixtures/5.atendimentos/anexos/minimos/sample.pdf'));
