/** Error carrying an i18n key, so the UI can render the message in the active language. */
export class InputError extends Error {
  constructor(key) {
    super(key);
    this.key = key;
  }
}

/** Parse a required numeric field; throws InputError('errEmpty' | 'errNum'). */
export function requiredNumber(raw) {
  const s = raw == null ? '' : String(raw).trim();
  if (!s) throw new InputError('errEmpty');
  const v = Number(s);
  if (!Number.isFinite(v)) throw new InputError('errNum');
  return v;
}

/** Parse an optional numeric field; empty → null. */
export function optionalNumber(raw) {
  const s = raw == null ? '' : String(raw).trim();
  if (!s) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) throw new InputError('errNum');
  return v;
}
