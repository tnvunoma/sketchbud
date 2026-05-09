import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Canvas from "../components/Canvas";
import { useOperationLog } from "../components/Useoperationlog";
import type { Operation } from "../components/Useoperationlog";
import "../LobbyPage.css";

export default function LobbyPage() {
  const socketRef = useRef<WebSocket | null>(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "ws://localhost:8080";
  const navigate = useNavigate();
  const { roomId } = useParams();

  const userId = localStorage.getItem("userId") || crypto.randomUUID();
  localStorage.setItem("userId", userId);

  const opLog = useOperationLog({
    userId,
    onCommit: (op) => socketRef.current?.send(JSON.stringify(op)),
    onUndo: (id) =>
      socketRef.current?.send(JSON.stringify({ type: "undo", opId: id })),
    onRedo: (op) =>
      socketRef.current?.send(JSON.stringify({ type: "redo", op })),
  });

  useEffect(() => {
    console.log("ROOM ID:", roomId);
    const socket = new WebSocket(
      `${backendUrl}/ws?room=${roomId}&user=${userId}`
    );
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("CONNECTED");
    };

    socket.onerror = (err) => {
      console.log("WS ERROR", err);
    };

    socket.onclose = () => {
      console.log("CLOSED");
    };

    socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("received:", data); // ← what is actually coming in?

    if (Array.isArray(data)) {
      data.forEach((op: Operation) => opLog.addOperation(op));
      return;
    }

    if (data.type === "undo") {
      console.log("handling undo for:", data.opId);
      opLog.removeOperation(data.opId);
      return;
    }

    if (data.type === "redo") {
      console.log("handling redo for:", data.op);
      opLog.addOperation(data.op);
      return;
    }

    opLog.addOperation(data as Operation);
  };

    return () => {
      socket.close();
    };
  }, [roomId]);

  return (
    <div>
      <button
        className="lobby-back-btn"
        onClick={() => {
          socketRef.current?.close();
          navigate("/");
        }}
      >
        ⬅ back to lobbies
      </button>

      <Canvas userId={userId} roomId={roomId} opLog={opLog} />
    </div>
  );
}
