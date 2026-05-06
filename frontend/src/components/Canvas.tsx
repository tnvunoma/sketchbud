import { useEffect, useRef, useState, useCallback } from "react";
import { useOperationLog } from "./Useoperationlog";
import type { Operation, Point, StrokeOp } from "./Useoperationlog";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  floodFill,
  replayLog,
  renderLiveStroke,
} from "./CanvasRenderer";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = "draw" | "erase" | "fill";

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID = "local-user"; // Replace with real user id from your auth system

const COLORS = [
  "#1a1a1a",
  "#ffffff",
  "#e24b4a",
  "#378add",
  "#1d9e75",
  "#ef9f27",
  "#d4537e",
  "#7f77dd",
];

const STABILIZER_WINDOW = 4; // Number of points to average for stabilization

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Stabilize points by averaging a trailing window — reduces shakiness */
function stabilize(points: Point[], window: number): Point {
  const slice = points.slice(-window);
  return {
    x: slice.reduce((s, p) => s + p.x, 0) / slice.length,
    y: slice.reduce((s, p) => s + p.y, 0) / slice.length,
  };
}

function getEventPos(
  e: React.MouseEvent | React.TouchEvent,
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  if ("touches" in e) {
    const t = e.touches[0];
    return {
      x: (t.clientX - rect.left) * scaleX,
      y: (t.clientY - rect.top) * scaleY,
    };
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

/** SVG circle cursor that matches brush size */
function buildCursor(size: number, tool: Tool): string {
  const r = Math.max(2, size / 2);
  const dim = Math.ceil(r * 2 + 4);
  const c = dim / 2;
  const color = tool === "erase" ? "%23e24b4a" : "%231a1a1a";
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${dim}' height='${dim}'>` +
    `<circle cx='${c}' cy='${c}' r='${r}' fill='none' stroke='${color}' stroke-width='1.5' opacity='0.8'/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${svg}") ${c} ${c}, crosshair`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DrawingCanvas() {
  // Two canvases: committed layer + live preview layer on top
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const isDrawing = useRef(false);
  const rawPoints = useRef<Point[]>([]); // unsmoothed points this stroke
  const smoothPoints = useRef<Point[]>([]); // stabilized points this stroke
  const currentStrokeId = useRef<string>("");

  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#1a1a1a");
  const [brushSize, setBrushSize] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const opLog = useOperationLog({
    userId: USER_ID,
    // onCommit: (op) => ws.send(JSON.stringify(op)),       // ← wire to your WebSocket
    // onUndo:   (id) => ws.send(JSON.stringify({ type: "undo", opId: id })),
    // onRedo:   (op) => ws.send(JSON.stringify({ type: "redo", op })),
  });

  // ── Sync undo/redo button state ──────────────────────────────────────────────
  const syncUndoState = useCallback(() => {
    setCanUndo(opLog.canUndo());
    setCanRedo(opLog.canRedo());
  }, [opLog]);

  // ── Initialize committed canvas ──────────────────────────────────────────────
  useEffect(() => {
    const ctx = committedRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, []);

  // ── Replay full log onto committed canvas (called after undo/redo/remote op) ─
  const replayToCommitted = useCallback(() => {
    const ctx = committedRef.current?.getContext("2d");
    if (!ctx) return;
    replayLog(ctx, opLog.getLog());
  }, [opLog]);

  // ── Commit current stroke to log and committed canvas ────────────────────────
  const commitStroke = useCallback(
    (pts: Point[]) => {
      if (pts.length === 0) return;
      const op: StrokeOp = {
        type: "stroke",
        id: currentStrokeId.current,
        userId: USER_ID,
        points: pts,
        color,
        size: brushSize,
        opacity,
        compositeOp: tool === "erase" ? "destination-out" : "source-over",
      };
      opLog.commit(op);
      // Render to committed canvas
      const ctx = committedRef.current?.getContext("2d");
      if (ctx) renderLiveStroke(ctx, op);
      syncUndoState();
    },
    [tool, color, brushSize, opacity, opLog, syncUndoState],
  );

  // ── Drawing event handlers ───────────────────────────────────────────────────

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = liveRef.current;
      if (!canvas) return;

      if (tool === "fill") {
        const pos = getEventPos(e, canvas);
        const committedCtx = committedRef.current?.getContext("2d");
        if (!committedCtx) return;
        floodFill(committedCtx, Math.round(pos.x), Math.round(pos.y), color);
        const op: Operation = {
          type: "fill",
          id: uid(),
          userId: USER_ID,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          color,
        };
        opLog.commit(op);
        syncUndoState();
        return;
      }

      isDrawing.current = true;
      currentStrokeId.current = uid();
      rawPoints.current = [];
      smoothPoints.current = [];

      const pos = getEventPos(e, canvas);
      rawPoints.current.push(pos);
      smoothPoints.current.push(pos);
    },
    [tool, color, opLog, syncUndoState],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing.current) return;
      const canvas = liveRef.current;
      if (!canvas) return;

      const pos = getEventPos(e, canvas);
      rawPoints.current.push(pos);

      // Stabilize
      const stable = stabilize(rawPoints.current, STABILIZER_WINDOW);
      smoothPoints.current.push(stable);

      // Clear live layer and re-draw the in-progress stroke
      const liveCtx = canvas.getContext("2d")!;
      liveCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      renderLiveStroke(liveCtx, {
        type: "stroke",
        id: currentStrokeId.current,
        userId: USER_ID,
        points: smoothPoints.current,
        color,
        size: brushSize,
        opacity,
        compositeOp: tool === "erase" ? "destination-out" : "source-over",
      });
    },
    [tool, color, brushSize, opacity],
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    // Clear live layer
    const liveCtx = liveRef.current?.getContext("2d");
    if (liveCtx) liveCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    commitStroke(smoothPoints.current);
    rawPoints.current = [];
    smoothPoints.current = [];
  }, [commitStroke]);

  // ── Undo / Redo ──────────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    opLog.undo();
    replayToCommitted();
    syncUndoState();
  }, [opLog, replayToCommitted, syncUndoState]);

  const handleRedo = useCallback(() => {
    opLog.redo();
    replayToCommitted();
    syncUndoState();
  }, [opLog, replayToCommitted, syncUndoState]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === "b") setTool("draw");
      if (e.key === "e") setTool("erase");
      if (e.key === "f") setTool("fill");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  // ── Clear ────────────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    const op: Operation = { type: "clear", id: uid(), userId: USER_ID };
    opLog.commit(op);
    const ctx = committedRef.current?.getContext("2d");
    if (ctx) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    syncUndoState();
  }, [opLog, syncUndoState]);

  // ── Cursor ───────────────────────────────────────────────────────────────────
  const cursor = tool === "fill" ? "crosshair" : buildCursor(brushSize, tool);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={s.wrapper}>
      {/* ── Toolbar ── */}
      <div style={s.toolbar}>
        {/* Undo / Redo */}
        <div style={s.group}>
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            style={{ ...s.iconBtn, opacity: canUndo ? 1 : 0.35 }}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            ↩
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            style={{ ...s.iconBtn, opacity: canRedo ? 1 : 0.35 }}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >
            ↪
          </button>
        </div>

        <div style={s.sep} />

        {/* Tools */}
        <div style={s.group}>
          {(["draw", "erase", "fill"] as Tool[]).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              title={`${t} (${t[0]})`}
              style={{ ...s.btn, ...(tool === t ? s.btnActive : {}) }}
            >
              {TOOL_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div style={s.sep} />

        {/* Color swatches */}
        <div style={s.group}>
          {COLORS.map((hex) => (
            <button
              key={hex}
              aria-label={hex}
              onClick={() => setColor(hex)}
              style={{
                ...s.swatch,
                background: hex,
                boxShadow: hex === "#ffffff" ? "inset 0 0 0 1px #ccc" : "none",
                outline:
                  color === hex
                    ? `2.5px solid ${hex === "#ffffff" ? "#aaa" : hex}`
                    : "2.5px solid transparent",
                outlineOffset: 2,
              }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={s.colorPicker}
            title="Custom color"
            aria-label="Custom color"
          />
        </div>

        <div style={s.sep} />

        {/* Brush size */}
        <div style={s.group}>
          <span style={s.label}>Size</span>
          <input
            type="range"
            min={1}
            max={80}
            step={1}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: 80 }}
            aria-label="Brush size"
          />
          <span style={{ ...s.label, minWidth: 26 }}>{brushSize}px</span>
        </div>

        <div style={s.sep} />

        {/* Opacity */}
        <div style={s.group}>
          <span style={s.label}>Opacity</span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            style={{ width: 70 }}
            aria-label="Brush opacity"
          />
          <span style={{ ...s.label, minWidth: 30 }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>

        <div style={s.sep} />

        <button onClick={handleClear} style={s.btn} title="Clear canvas">
          🗑 Clear
        </button>
      </div>

      {/* ── Canvas stack ── */}
      <div style={{ ...s.canvasWrap, cursor }}>
        {/* Committed layer */}
        <canvas
          ref={committedRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={s.canvas}
        />
        {/* Live preview layer — sits on top, transparent except during active stroke */}
        <canvas
          ref={liveRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{ ...s.canvas, position: "absolute", top: 0, left: 0 }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={(e) => {
            e.preventDefault();
            draw(e);
          }}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div style={s.hint}>
        <span>B = brush · E = erase · F = fill · ⌘Z = undo · ⌘⇧Z = redo</span>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const TOOL_ICONS: Record<Tool, string> = {
  draw: "✏️",
  erase: "🧹",
  fill: "🪣",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontFamily: "sans-serif",
    userSelect: "none",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    padding: "8px 12px",
    background: "#f9f9f9",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
  },
  group: { display: "flex", alignItems: "center", gap: 6 },
  sep: { width: 1, height: 24, background: "#ddd", margin: "0 2px" },
  label: { fontSize: 12, color: "#888" },
  btn: {
    display: "flex",
    alignItems: "center",
    padding: "5px 11px",
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 7,
    cursor: "pointer",
  },
  btnActive: { background: "#efefef", border: "1px solid #ccc", color: "#111" },
  iconBtn: {
    padding: "4px 9px",
    fontSize: 16,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 7,
    cursor: "pointer",
    color: "#555",
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  colorPicker: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "none",
    padding: 0,
    cursor: "pointer",
    background: "none",
  },
  canvasWrap: {
    position: "relative",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    overflow: "hidden",
    background: "#fff",
    display: "inline-block",
    width: "100%",
  },
  canvas: { display: "block", width: "100%", height: "auto" },
  hint: { fontSize: 11, color: "#bbb", textAlign: "center" },
};
