const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const limitesDir = path.join(baseDir, 'limites');

fs.mkdirSync(limitesDir, { recursive: true });

console.log('Criando pastas em:', baseDir);

// -------------------------------------------------------------
// ESCOPO DESTE SCRIPT (24/09/2026)
// -------------------------------------------------------------
// Os anexos de formato mínimo/normal (JPG, PDF, DOC, DOCX, XLS, XLSX, TXT, MP3, MP4) usados pelos
// testes de envio/prévia/download NÃO são mais gerados por script: são arquivos reais, escolhidos
// e validados manualmente pelo operador, em `cypress/fixtures/5.atendimentos/anexos/normal/`
// (pasta antes chamada `minimos/`). Este gerador cuida exclusivamente dos arquivos de FRONTEIRA DE
// TAMANHO (`limites/`) usados para validar o teto global de upload (413 acima do limite, aceite
// abaixo dele) — onde o conteúdo real do arquivo é irrelevante e só o tamanho em bytes importa.

// Cabeçalho JPEG mínimo e conteúdo PDF mínimo, usados apenas para "vestir" os arquivos de fronteira
// de tamanho abaixo com magic bytes válidos — não são fixtures de teste por si (ver `normal/` acima).
const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
const jpegFooter = Buffer.from([0xFF, 0xD9]);
const pdfHeader = Buffer.from('%PDF-1.4\n', 'utf8');
const pdfFooter = Buffer.from('\n%%EOF\n', 'utf8');

// -------------------------------------------------------------
// 1. ARQUIVOS DE LIMITE DE EXIBIÇÃO:
// a) midia-indisponivel-8mb.jpg (8 MB = 8.388.608 bytes)
//    Fica entre 5 MB e 10 MB: acima do teto de imagem (5 MB), o front recusa na seleção com o aviso do teto, sem prévia nem upload (front#595/PR #598).
// -------------------------------------------------------------
const target8MB = 8 * 1024 * 1024; // 8 MB
const buf8MB = Buffer.alloc(target8MB);
jpegHeader.copy(buf8MB, 0);
buf8MB.fill(0x37, jpegHeader.length, target8MB - jpegFooter.length);
jpegFooter.copy(buf8MB, target8MB - jpegFooter.length);
fs.writeFileSync(path.join(limitesDir, 'midia-indisponivel-8mb.jpg'), buf8MB);

// -------------------------------------------------------------
// b) arquivo-acima-limite-11mb.pdf (11 MB = 11.534.336 bytes)
//    Excede o teto global de 10 MB (10.485.760 bytes): rejeição 422 ou 413.
// -------------------------------------------------------------
const target11MB = 11 * 1024 * 1024; // 11 MB
const buf11MB = Buffer.alloc(target11MB, 0x20); // preenchido com espaços
pdfHeader.copy(buf11MB, 0);
pdfFooter.copy(buf11MB, target11MB - pdfFooter.length);
fs.writeFileSync(path.join(limitesDir, 'arquivo-acima-limite-11mb.pdf'), buf11MB);

// -------------------------------------------------------------
// 2. ARQUIVOS DE TETO MÁXIMO POR TIPO E TETO GLOBAL
// -------------------------------------------------------------
function createFastLargeFile(filePath, sizeBytes, header, tail) {
  const fd = fs.openSync(filePath, 'w');
  if (header) fs.writeSync(fd, header);
  const chunkSize = 1024 * 1024; // 1 MB
  const chunk = Buffer.alloc(chunkSize, 0x30);
  let remaining = sizeBytes - (header ? header.length : 0) - (tail ? tail.length : 0);
  while (remaining > 0) {
    const toWrite = Math.min(remaining, chunkSize);
    fs.writeSync(fd, chunk, 0, toWrite);
    remaining -= toWrite;
  }
  if (tail) fs.writeSync(fd, tail);
  fs.closeSync(fd);
}

// a) Teto Global Exato: 10 MB (10.485.760 bytes)
createFastLargeFile(path.join(limitesDir, 'teto-global-10mb.pdf'), 10485760, pdfHeader, pdfFooter);

// b) Imagem 16 MB (16.777.216 bytes)
createFastLargeFile(path.join(limitesDir, 'max-imagem-16mb.jpg'), 16777216, jpegHeader, jpegFooter);

// c) Áudio 16 MB (16.777.216 bytes)
createFastLargeFile(path.join(limitesDir, 'max-audio-16mb.mp3'), 16777216, Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]), Buffer.from([0xFF, 0xFB, 0x90, 0x64]));

// d) Vídeo 64 MB (67.108.864 bytes)
createFastLargeFile(path.join(limitesDir, 'max-video-64mb.mp4'), 67108864, Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), Buffer.from([0x00, 0x00, 0x00, 0x08, 0x6D, 0x6F, 0x6F, 0x76]));

// e) Documento 100 MB (104.857.600 bytes)
createFastLargeFile(path.join(limitesDir, 'max-documento-100mb.pdf'), 104857600, pdfHeader, pdfFooter);

// -------------------------------------------------------------
// 3. FRONTEIRA DO TETO GLOBAL ÚNICO DE 16 MB (backend#455 / #463 e front#344 / PR #419)
//     O backend unificou o teto em 16 MB para TODOS os tipos (spring.servlet.multipart.max-file-size),
//     com max-request-size de 18 MB. As tabelas antigas por tipo (16/16/64/100 MB) deixaram de valer
//     e o front parou de validar tamanho localmente: quem recusa é o servidor, com 413 nomeando o número.
//     (Desde a front#595/PR #598 o front voltou a recusar na seleção: imagem 5 MB, demais tipos 10 MB; o 413/422 do servidor é rede de proteção.)
//     Os dois arquivos abaixo cercam essa fronteira de forma determinística, evitando o valor exato
//     de 16 MiB (limite inclusivo/exclusivo indefinido) e o corte de conexão acima de 18 MB.
// -------------------------------------------------------------

// a) Abaixo do teto de 16 MB: 15 MB (15.728.640 bytes). Para documento, áudio e vídeo continua acima do teto de 10 MB do front
//    (front#595/PR #598), então é recusado na seleção, sem upload; serve de arquivo "acima do teto por tipo" nos testes
createFastLargeFile(path.join(limitesDir, 'abaixo-teto-15mb.pdf'), 15728640, pdfHeader, pdfFooter);

// b) Acima do teto: 17 MB (17.825.792 bytes) -> acima do max-file-size (16 MB) e abaixo do
//    max-request-size (18 MB), faixa em que o container devolve 413 com corpo JSON nomeando o limite
createFastLargeFile(path.join(limitesDir, 'acima-teto-17mb.pdf'), 17825792, pdfHeader, pdfFooter);

console.log('Todos os arquivos de limite de exibição, tetos máximos por tipo e fronteira de 16 MB foram gerados com sucesso!');
