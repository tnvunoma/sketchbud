import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Canvas from "../components/Canvas";

// import fabric from "fabric";
// import { socket } from "../networking/socket";

export default function LobbyPage() {
  const socketRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();
  const { roomId } = useParams();

  const userId = localStorage.getItem("userId") || crypto.randomUUID();
  localStorage.setItem("userId", userId);

  useEffect(() => {
    console.log("ROOM ID:", roomId);
    const socket = new WebSocket(`ws://localhost:8080/ws?room=${roomId}&user=${userId}`);
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
      <button
        onClick={() => {
          socketRef.current?.close(); 
          navigate("/");
        }}
      >
        ⬅ Return to Lobby List
      </button>

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
