import type { Operation, Point, StrokeOp, FillOp } from "./Useoperationlog";

export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 520;

// ─── Catmull-Rom spline interpolation for smooth strokes ──────────────────────

function catmullRomSegment(
  ctx: CanvasRenderingContext2D,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = 12
) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    ctx.lineTo(x, y);
  }
}

function renderStroke(ctx: CanvasRenderingContext2D, op: StrokeOp) {
  if (op.points.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = op.compositeOp;
  ctx.globalAlpha = op.compositeOp === "destination-out" ? 1 : op.opacity;
  ctx.strokeStyle = op.compositeOp === "destination-out" ? "rgba(0,0,0,1)" : op.color;
  ctx.lineWidth = op.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const pts = op.points;

  if (pts.length === 1) {
    // Single dot
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, op.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = op.compositeOp === "destination-out" ? "rgba(0,0,0,1)" : op.color;
    ctx.fill();
  } else if (pts.length < 4) {
    // Short stroke — plain line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  } else {
    // Catmull-Rom spline
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 2; i++) {
      catmullRomSegment(ctx, pts[i - 1], pts[i], pts[i + 1], pts[i + 2]);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Flood fill ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string
) {
  const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imageData.data;
  const idx = (startY * CANVAS_WIDTH + startX) * 4;
  const [tR, tG, tB, tA] = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  const [fR, fG, fB] = hexToRgb(fillColor);

  if (tR === fR && tG === fG && tB === fB && tA === 255) return;

  const tolerance = 30;
  const matches = (i: number) =>
    Math.abs(data[i] - tR) <= tolerance &&
    Math.abs(data[i + 1] - tG) <= tolerance &&
    Math.abs(data[i + 2] - tB) <= tolerance &&
    Math.abs(data[i + 3] - tA) <= tolerance;

  const stack = [startX + startY * CANVAS_WIDTH];
  const visited = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT);

  while (stack.length) {
    const pos = stack.pop()!;
    if (visited[pos]) continue;
    visited[pos] = 1;
    const x = pos % CANVAS_WIDTH;
    const y = Math.floor(pos / CANVAS_WIDTH);
    const i = pos * 4;
    if (!matches(i)) continue;
    data[i] = fR; data[i + 1] = fG; data[i + 2] = fB; data[i + 3] = 255;
    if (x > 0) stack.push(pos - 1);
    if (x < CANVAS_WIDTH - 1) stack.push(pos + 1);
    if (y > 0) stack.push(pos - CANVAS_WIDTH);
    if (y < CANVAS_HEIGHT - 1) stack.push(pos + CANVAS_WIDTH);
  }

  ctx.putImageData(imageData, 0, 0);
}

// ─── Full log replay ──────────────────────────────────────────────────────────

export function replayLog(ctx: CanvasRenderingContext2D, ops: Operation[]) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  for (const op of ops) {
    if (op.type === "stroke") {
      renderStroke(ctx, op);
    } else if (op.type === "fill") {
      floodFill(ctx, op.x, op.y, op.color);
    } else if (op.type === "clear") {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }
  }
}

// ─── Live stroke rendering (called during mouse move, before stroke is committed) ─

export function renderLiveStroke(ctx: CanvasRenderingContext2D, op: StrokeOp) {
  renderStroke(ctx, op);
}