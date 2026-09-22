/** Center the visible ink, rather than the font's em box or advance width. */
export function drawCenteredDieLabel(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number,
  underline = false,
) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText(text);
  const left = -metrics.actualBoundingBoxLeft;
  const right = metrics.actualBoundingBoxRight;
  const top = -metrics.actualBoundingBoxAscent;
  const bottom = metrics.actualBoundingBoxDescent;
  const lineGap = fontSize * 0.07;
  const lineHeight = fontSize * 0.045;
  const inkBottom = underline ? bottom + lineGap + lineHeight : bottom;
  const baseline = y - (top + inkBottom) / 2;
  ctx.fillText(text, x - (left + right) / 2, baseline);
  if (underline) {
    const width = Math.max(right - left, fontSize * 0.38);
    ctx.fillRect(x - width / 2, baseline + bottom + lineGap, width, lineHeight);
  }
}
