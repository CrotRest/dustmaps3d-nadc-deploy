/** Hand a Blob (or a same-origin URL) to the browser as a file download. */
export function saveFile(source, filename) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof source !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000);
}
