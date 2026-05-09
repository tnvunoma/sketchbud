import { useRef, useCallback, useState } from "react";

// ─── Operation Types ──────────────────────────────────────────────────────────

export type Point = { x: number; y: number };

export type StrokeOp = {
  type: "stroke";
  id: string;
  userId: string;
  roomId: string;
  points: Point[];
  color: string;
  size: number;
  opacity: number;
  compositeOp: "source-over" | "destination-out";
};

export type FillOp = {
  type: "fill";
  id: string;
  userId: string;
  roomId: string;
  x: number;
  y: number;
  color: string;
};

export type ClearOp = {
  type: "clear";
  id: string;
  userId: string;
  roomId: string;
};

export type Operation = StrokeOp | FillOp | ClearOp;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the canonical operation log and per-user undo/redo stacks.
 *
 * Backend integration points:
 *   - Call `addOperation(op)` when you receive an op from the server.
 *   - Call `removeOperation(id)` when the server confirms an undo.
 *   - The `onCommit` callback fires on every local op — send it to your server.
 *   - The `onUndo` / `onRedo` callbacks fire with the op id — send undo/redo
 *     messages to your server so it can broadcast the log change to other clients.
 */
export function useOperationLog(options: {
  userId: string;
  onCommit?: (op: Operation) => void;
  onUndo?: (opId: string) => void;
  onRedo?: (op: Operation) => void;
}) {
  const { onCommit, onUndo, onRedo } = options;

  // Canonical log — ordered list of all committed ops across all users
  const log = useRef<Operation[]>([]);

  // Per-user undo stack: ids of ops this user can undo (in commit order)
  const undoStack = useRef<string[]>([]);

  // Per-user redo stack: ops that were undone and can be re-applied
  const redoStack = useRef<Operation[]>([]);

  const [version, setVersion] = useState(0); 
  const bump = () => setVersion(v => v + 1);

  const commit = useCallback(
    (op: Operation) => {
      log.current.push(op);
      undoStack.current.push(op.id);
      redoStack.current = []; // new op clears redo
      onCommit?.(op);
      bump();
    },
    [onCommit]
  );

  // Called when another user's op arrives from the server
  const addOperation = useCallback((op: Operation) => {
    log.current.push(op);
    bump();
  }, []);

  // Called when the server confirms an undo (removes op from canonical log)
  const removeOperation = useCallback((id: string) => {
    log.current = log.current.filter((op) => op.id !== id);
    bump();
  }, []);

  const canUndo = () => undoStack.current.length > 0;
  const canRedo = () => redoStack.current.length > 0;

  const undo = useCallback((): string | null => {
    const id = undoStack.current.pop();
    if (!id) return null;
    const op = log.current.find((o) => o.id === id);
    if (!op) return null;
    log.current = log.current.filter((o) => o.id !== id);
    redoStack.current.push(op);
    onUndo?.(id);
    bump();
    return id;
  }, [onUndo]);

  const redo = useCallback((): Operation | null => {
    const op = redoStack.current.pop();
    if (!op) return null;
    log.current.push(op);
    undoStack.current.push(op.id);
    onRedo?.(op);
    bump();
    return op;
  }, [onRedo]);

  const getLog = () => log.current;

  return { commit, addOperation, removeOperation, undo, redo, canUndo, canRedo, getLog, version};
}