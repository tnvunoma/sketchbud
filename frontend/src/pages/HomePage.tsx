import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  const lobbies = [
    { id: "room_1", name: "Lobby 1" },
    { id: "room_2", name: "Lobby 2" },
    { id: "room_3", name: "Lobby 3" },
  ];

  return (
    <div>
      <h1>Select a Lobby</h1>

      {lobbies.map((lobby) => (
        <button
          key={lobby.id}
          onClick={() => navigate(`/lobby/${lobby.id}`)}
        >
          {lobby.name}
        </button>
      ))}
    </div>
  );
}