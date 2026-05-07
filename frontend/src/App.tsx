// App.tsx
import { Routes, Route } from "react-router-dom";
import LobbyPage from "./pages/LobbyPage";
import HomePage from "./pages/HomePage";

function App() {
  
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/lobby/:roomId" element={<LobbyPage />} />
    </Routes>
  );
}

export default App;