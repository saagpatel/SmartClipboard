import { useState } from "react";
import { HistoryList } from "./components/HistoryList";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatsPanel } from "./components/StatsPanel";
import "./styles/index.css";

type View = "history" | "settings" | "stats";

function App() {
  const [currentView, setCurrentView] = useState<View>("history");

  return (
    <div className="app-container">
      {currentView === "settings" ? (
        <SettingsPanel onClose={() => setCurrentView("history")} />
      ) : currentView === "stats" ? (
        <StatsPanel onClose={() => setCurrentView("history")} />
      ) : (
        <>
          <HistoryList />
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={() => setCurrentView("stats")}
              className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center shadow-lg border border-[var(--border)]"
              title="Statistics"
            >
              📊
            </button>
            <button
              onClick={() => setCurrentView("settings")}
              className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center shadow-lg border border-[var(--border)]"
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
