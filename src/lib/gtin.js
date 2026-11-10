// GTIN (EAN-8, UPC-A 12, EAN-13, GTIN-14) validation with the GS1 check digit.
// Lessons L12: a GTIN goes into structured data only if this returns a value.

export function normalizeGtin(value) {
  const digits = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  if (/^0+$/.test(digits)) return null;
  let sum = 0;
  const body = digits.slice(0, -1);
  for (let i = 0; i < body.length; i++) {
    const n = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[digits.length - 1]) ? digits : null;
}

// Barcode search (lessons L115): every text form of the same GTIN that a database may hold. GS1 keeps every GTIN in
// 14 digits, right-aligned with leading zeros: a UPC-A (12) is the EAN-13 with a leading 0, an EAN-8 is the same GTIN with
// six zeros in front, a GTIN-14 that starts with zeros is the shorter code. So two codes are the same GTIN exactly when
// their 14-digit forms are equal, and the forms are that 14-digit text with 0, 1, 2 ... of its leading zeros taken off
// (down to the first other digit: a feed that lost its leading zeros as a number, e.g. CGW keeps 81 UPCs as 11 digits).
// null when the code is not a valid GTIN (normalizeGtin: 8, 12, 13 or 14 digits and the GS1 check digit).
export function gtinForms(value) {
  if (String(value ?? '').length > 64) return null;
  const gtin = normalizeGtin(value);
  if (!gtin) return null;
  const full = gtin.padStart(14, '0');
  const forms = [full];
  for (let k = 1; k < full.length && full[k - 1] === '0'; k++) forms.push(full.slice(k));
  return { gtin, gtin14: full, forms };
}

export function gtinSchemaKey(gtin) {
  switch (gtin.length) {
    case 8: return 'gtin8';
    case 12: return 'gtin12';
    case 13: return 'gtin13';
    default: return 'gtin14';
  }
}
