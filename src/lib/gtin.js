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

export function gtinSchemaKey(gtin) {
  switch (gtin.length) {
    case 8: return 'gtin8';
    case 12: return 'gtin12';
    case 13: return 'gtin13';
    default: return 'gtin14';
  }
}
