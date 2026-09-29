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

/** Fit both lines inside the inset diamond of a cube face, then center their combined ink. */
export function drawPlotFace(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, radius: number) {
  const symbol = value <= 2 ? '✦' : value <= 4 ? '○' : '!';
  const caption = value <= 2 ? 'OPPORTUNITY' : value <= 4 ? 'BLANK' : value === 5 ? '+2' : '+4';
  const fit = (text: string, family: string, maxWidth: number, maxHeight: number) => {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `bold 100px ${family}`;
    const metrics = ctx.measureText(text);
    const width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const scale = Math.min(maxWidth / Math.max(width, 1), maxHeight / Math.max(height, 1));
    return { text, font: `bold ${100 * scale}px ${family}`, size: 100 * scale, height: height * scale };
  };
  const icon = fit(symbol, 'Georgia, serif', radius, radius * 0.9);
  const label = fit(caption, 'system-ui, sans-serif', radius * 1.2, radius * 0.22);
  const gap = radius * 0.12;
  const top = y - (icon.height + gap + label.height) / 2;
  ctx.font = icon.font;
  drawCenteredDieLabel(ctx, icon.text, x, top + icon.height / 2, icon.size);
  ctx.font = label.font;
  drawCenteredDieLabel(ctx, label.text, x, top + icon.height + gap + label.height / 2, label.size);
}
