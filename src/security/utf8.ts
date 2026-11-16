/**
 * Conversion texte ⇄ octets (UTF-8), écrite ici pour ne dépendre d'aucune
 * fonction du moteur JavaScript du téléphone.
 */
export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    // Paire de substitution : un caractère hors du plan de base (émoji…).
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk: number[] = [];
  const flush = () => {
    if (chunk.length) parts.push(String.fromCharCode(...chunk));
    chunk = [];
  };
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let code: number;
    if (b < 0x80) {
      code = b;
      i += 1;
    } else if (b < 0xe0) {
      code = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      i += 2;
    } else if (b < 0xf0) {
      code = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      i += 3;
    } else {
      code = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      i += 4;
    }
    if (code >= 0x10000) {
      code -= 0x10000;
      chunk.push(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      chunk.push(code);
    }
    // On vide régulièrement le tampon : String.fromCharCode n'accepte pas un nombre illimité d'arguments.
    if (chunk.length >= 4096) flush();
  }
  flush();
  return parts.join('');
}

const HEX = '0123456789abcdef';
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 15];
  return out;
}

/** Comparaison en temps constant : la durée ne révèle pas où les deux chaînes diffèrent. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
