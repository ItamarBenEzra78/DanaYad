/**
 * Insert pasted plain text. Each line becomes its own block (<div>, the
 * paragraph element contenteditable uses for Enter), so list and alignment
 * commands treat pasted lines as separate paragraphs.
 */
export function insertPlainText(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length === 1) {
    document.execCommand('insertText', false, text);
    return;
  }
  const html = lines.map(line => {
    const div = document.createElement('div');
    if (line) div.textContent = line;
    else div.appendChild(document.createElement('br'));
    return div.outerHTML;
  }).join('');
  document.execCommand('insertHTML', false, html);
}
