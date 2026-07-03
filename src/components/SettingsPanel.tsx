import { useEffect, useState } from "react";
import type { Settings } from "../types";
import { getSettings, updateSettings, getExclusions, addExclusion, removeExclusion } from "../lib/ipc";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "privacy">("general");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadExclusions();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const loadExclusions = async () => {
    try {
      const data = await getExclusions();
      setExclusions(data);
    } catch (error) {
      console.error("Failed to load exclusions:", error);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    // Validate settings
    if (settings.maxItems < 10 || settings.maxItems > 100000) {
      alert("Max items must be between 10 and 100,000");
      return;
    }

    if (settings.retentionDays < 1) {
      alert("Retention period must be at least 1 day");
      return;
    }

    if (settings.maxImageSizeMb < 1 || settings.maxImageSizeMb > 100) {
      alert("Max image size must be between 1 and 100 MB");
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings(settings);
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 500);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings. Please try again.");
      setIsSaving(false);
    }
  };

  const handleAddExclusion = async () => {
    const appName = newExclusion.trim();
    if (!appName) return;

    try {
      await addExclusion(appName);
      await loadExclusions();
      setNewExclusion("");
    } catch (error) {
      console.error("Failed to add exclusion:", error);
    }
  };

  const handleRemoveExclusion = async (appName: string) => {
    try {
      await removeExclusion(appName);
      await loadExclusions();
    } catch (error) {
      console.error("Failed to remove exclusion:", error);
    }
  };

  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h2>
        <button
          onClick={onClose}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === "general"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("privacy")}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === "privacy"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Privacy
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollable p-4">
        {activeTab === "general" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Retention Period
              </label>
              <select
                value={settings.retentionDays}
                onChange={(e) => setSettings({ ...settings, retentionDays: Number(e.target.value) })}
                className="w-full bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 rounded-lg border border-[var(--border)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
                <option value={36500}>Forever</option>
              </select>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Items older than this will be automatically deleted
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Max Items
              </label>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={settings.maxItems}
                onChange={(e) => setSettings({ ...settings, maxItems: Number(e.target.value) })}
                className="w-full bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 rounded-lg border border-[var(--border)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Maximum number of items to keep in history
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Keyboard Shortcut
              </label>
              <input
                type="text"
                value={settings.keyboardShortcut}
                readOnly
                className="w-full bg-[var(--bg-hover)] text-[var(--text-secondary)] px-3 py-2 rounded-lg border border-[var(--border)] cursor-not-allowed"
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Custom shortcuts coming in Phase 3
              </p>
            </div>
          </div>
        )}

        {activeTab === "privacy" && (
          <div className="space-y-6">
            <div>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Auto-exclude sensitive data
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoExcludeSensitive}
                  onChange={(e) => setSettings({ ...settings, autoExcludeSensitive: e.target.checked })}
                  className="w-5 h-5"
                />
              </label>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Automatically detect and skip credit cards, SSNs, and phone numbers
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                App Exclusions
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="App name (e.g., 1Password)"
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddExclusion()}
                  className="flex-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] px-3 py-2 rounded-lg border border-[var(--border)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <button
                  onClick={handleAddExclusion}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {exclusions.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)] italic">
                    No apps excluded yet
                  </p>
                ) : (
                  exclusions.map((app) => (
                    <div
                      key={app}
                      className="flex items-center justify-between bg-[var(--bg-secondary)] px-3 py-2 rounded-lg"
                    >
                      <span className="text-sm text-[var(--text-primary)]">{app}</span>
                      <button
                        onClick={() => handleRemoveExclusion(app)}
                        className="text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Clipboard items from these apps will not be captured
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
