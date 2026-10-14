/** Character statistics shown by the text-stats utility. */
export function textStats(txt) {
  return {
    total: txt.length,
    words: (txt.trim().match(/\b[\w'-]+\b/g) || []).length,
    cjk: (txt.match(/[㐀-鿿]/g) || []).length,
    letters: txt.replace(/[^a-zA-Z\s]/g, '').length,
    nonSpace: txt.replace(/\s/g, '').length,
  };
}
