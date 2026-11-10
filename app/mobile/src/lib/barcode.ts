// Product barcodes (EAN-13, EAN-8, UPC-A, UPC-E and GTIN-14), read by the camera or typed by the person.
// No React or native code, so it can be tested with plain Node. The barcode never leaves the phone as a picture:
// only its digits are sent to the Hub, which looks for the same product in every Gear World.

/** The barcode types the scanner looks for: the ones printed on products and their boxes. */
export const PRODUCT_BARCODES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/** Only the digits, at most 14 (spaces and dashes typed by hand are dropped). */
export function cleanCode(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 14);
}

/** The GS1 check digit is right (the same rule for 8, 12, 13 and 14 digits). */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // From the right: weight 3, 1, 3, 1, ...
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

/** UPC-E (8 digits, number system 0 or 1) written out as the 12-digit UPC-A it stands for. */
export function upcEToA(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0];
  const d = code.slice(1, 7);
  const check = code[7];
  const last = d[5];
  let body: string;
  if (last === '0' || last === '1' || last === '2') body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === '3') body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === '4') body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  const upcA = `${ns}${body}${check}`;
  return hasValidCheckDigit(upcA) ? upcA : null;
}

/**
 * The forms of one barcode that a retailer's feed may have used for the same product, best first:
 * a UPC-A is also stored as EAN-13 with a leading 0 (and GTIN-14 with two), an EAN-13 also as GTIN-14.
 * Returns [] when the number is not a valid product barcode.
 * `type` is what the scanner reported; "upc_e" turns the 8 digits into the UPC-A they stand for.
 */
export function gtinForms(raw: unknown, type = ''): string[] {
  let code = cleanCode(raw);
  if (code.length === 8 && /upc_?e/i.test(type)) {
    const a = upcEToA(code);
    if (!a) return [];
    code = a;
  }
  if (!hasValidCheckDigit(code)) return [];
  const forms: string[] = [];
  const add = (c: string) => { if (c && !forms.includes(c)) forms.push(c); };
  if (code.length === 14) {
    add(code);
    if (code.startsWith('0')) add(code.slice(1));
    if (code.startsWith('00')) add(code.slice(2));
  } else if (code.length === 13) {
    add(code);
    if (code.startsWith('0')) add(code.slice(1));
    add(`0${code}`);
  } else if (code.length === 12) {
    add(code);
    add(`0${code}`);
    add(`00${code}`);
  } else {
    add(code);
  }
  return forms;
}
