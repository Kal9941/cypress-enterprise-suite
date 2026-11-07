// Gera as imagens de capa reais (PNG válido, decodificável) usadas pelos testes de
// "Personalização do Orçamento" (Issue #449, PR #451) — dimensões reais importam porque o front
// lê width/height do próprio arquivo (checagem client-side de "imagem pequena" / "acima de 4096px"),
// diferente dos arquivos de fronteira de tamanho em anexos/limites (onde só o byte count importa e
// o conteúdo é garbage). PNG puro via zlib, sem dependências novas.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = __dirname;

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Gera um PNG RGB válido de width x height. Se `noise` for true, preenche com bytes
 * pseudo-aleatórios (incompressíveis, para estourar 5 MB de propósito); senão, cor sólida.
 */
function gerarPng(filePath, width, height, { r = 51, g = 123, b = 168, noise = false } = {}) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filtro "None" no início de cada linha
    for (let x = 0; x < width; x++) {
      if (noise) {
        raw[offset++] = Math.floor(Math.random() * 256);
        raw[offset++] = Math.floor(Math.random() * 256);
        raw[offset++] = Math.floor(Math.random() * 256);
      } else {
        raw[offset++] = r;
        raw[offset++] = g;
        raw[offset++] = b;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(raw, { level: noise ? 1 : 6 });

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);

  fs.writeFileSync(filePath, png);
  console.log(`${path.basename(filePath)}: ${width}x${height}, ${(png.length / (1024 * 1024)).toFixed(2)} MB`);
}

// 1. Capa ideal (dica da modal: "ideal 1200 × 450 px") - sem aviso de imagem pequena
gerarPng(path.join(outDir, 'capa-ideal-1200x450.png'), 1200, 450);

// 2. Capa pequena (abaixo de 600x225) - dispara o aviso "Imagem pequena"
gerarPng(path.join(outDir, 'capa-pequena-400x150.png'), 400, 150);

// 3. Capa grande o bastante para estourar 5 MB com ruído incompressível, mantendo width/height
//    dentro do teto de 4096px (senão cai no erro de "muitos pixels" em vez do de tamanho)
gerarPng(path.join(outDir, 'capa-acima-5mb.png'), 1600, 1600, { noise: true });

// 4. Formato não suportado - GIF89a mínimo e válido (1x1 px), só para acionar a checagem de
//    formato do front (a checagem de magic bytes só reconhece PNG/JPEG/WebP)
const gif = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
  0x01, 0x00, 0x01, 0x00, // 1x1
  0x80, 0x00, 0x00, // flags, background, aspect
  0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, // paleta: branco, preto
  0x21, 0xF9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, // graphic control extension
  0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // image descriptor
  0x02, 0x02, 0x44, 0x01, 0x00, // dados da imagem (LZW mínimo)
  0x3B // trailer
]);
fs.writeFileSync(path.join(outDir, 'formato-nao-suportado.gif'), gif);
console.log(`formato-nao-suportado.gif: ${gif.length} bytes`);

console.log('Capas de teste geradas com sucesso!');
