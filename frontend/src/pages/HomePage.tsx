import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import "../HomePage.css";

const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace("wss://", "https://").replace("ws://", "http://") || "http://localhost:8080";

// ── Petal cursor effect ──────────────────────────────────────────────────────
const PETAL_EMOJIS = ["🌸", "🌺", "🌼", "✿", "❀", "🌷"];
const LOBBY_EMOJIS = ["🌼", "🌺", "🪻",];
 
interface Petal {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  life: number; decay: number;
  rot: number; rotV: number;
  emoji: string;
}

function usePetalCursor(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const petals: Petal[] = [];
    let lastSpawn = 0;
    let rafId: number;
 
    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);
 
    function spawnPetal(x: number, y: number) {
      petals.push({
        x, y,
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * -1.5 - 0.5,
        size: Math.random() * 14 + 10,
        life: 1,
        decay: Math.random() * 0.025 + 0.018,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.12,
        emoji: PETAL_EMOJIS[Math.floor(Math.random() * PETAL_EMOJIS.length)],
      });
    }
 
    function onMouseMove(e: MouseEvent) {
      const now = Date.now();
      if (now - lastSpawn > 80) {
        spawnPetal(e.clientX, e.clientY);
        lastSpawn = now;
      }
    }
    window.addEventListener("mousemove", onMouseMove);
 
    function animate() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.rot += p.rotV;
        p.life -= p.decay;
        if (p.life <= 0) { petals.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = `${p.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
      }
      rafId = requestAnimationFrame(animate);
    }
    animate();
 
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [canvasRef]);
}

export default function HomePage() {
  const navigate = useNavigate();

  const lobbies = [
    { id: "room_1", name: "Room 1" },
    { id: "room_2", name: "Room 2" },
    { id: "room_3", name: "Room 3" },
  ];

  const petalCanvasRef = useRef<HTMLCanvasElement>(null);
  usePetalCursor(petalCanvasRef);

  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const fetchCounts = () =>
      fetch(`${backendUrl}/rooms`)
        .then(r => r.json())
        .then(setCounts);

    fetchCounts();
    const interval = setInterval(fetchCounts, 1000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="home-content">
        <div className="home-logo">
              <div className="home-logo__icon">🎨🖌️</div>
              <div className="home-logo__text">sketchbud</div>
              <div className="home-logo__sub">🌸 a website where you can draw together 🌸</div>
        </div>

        <div className="home-card">
          <div className="home-card__title">✨ pick a room</div>
          <div className="home-list">
            {lobbies.map((lobby, i) => (
              <button
                key={lobby.id}
                className="home-list__item"
                onClick={() => navigate(`/lobby/${lobby.id}`)}
              >
                <div className="home-list__left">
                  <span className="home-list__emoji">
                    {LOBBY_EMOJIS[i % LOBBY_EMOJIS.length]}
                  </span>
                  <div>
                    <div className="home-list__name">{lobby.name}</div>
                    {/* <span className="home-list__pill">{lobby.id}</span> */}
                    <span className="home-list__pill">
                      {counts[lobby.id] ?? 0} online
                    </span>
                  </div>
                </div>
                <span className="home-list__arrow">→</span>
              </button>
            ))}
          </div>
        </div>

        {/* Petal cursor canvas */}
          <canvas ref={petalCanvasRef} className="home-petal-canvas" />
      </div>

      
    </>
  );
}