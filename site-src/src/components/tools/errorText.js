/** Render a UI error produced by `toUiError` in the active language; backend detail is appended verbatim. */
export const errorText = (error, t) =>
  error.key ? `${t[error.key]}${error.detail ? ` (${error.detail})` : ''}` : error.message;
