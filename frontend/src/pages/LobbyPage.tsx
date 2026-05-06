import { useEffect, useRef } from "react";
import Canvas from "../components/Canvas";

// import fabric from "fabric";
// import { socket } from "../networking/socket";

export default function LobbyPage() {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/ws");
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
      console.log("Received:", event.data);
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div>
      <Canvas />
      {/* <button
        onClick={() => {
          socketRef.current?.send("hello");
        }}
      >
        Send Test
      </button> */}
    </div>
  );
}
