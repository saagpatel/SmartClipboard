import { useState, useEffect } from "react";
import type { Category, SearchFilters } from "../types";

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  onClear: () => void;
}

const categories: Category[] = ["url", "email", "error", "code", "command", "ip", "path", "misc"];

const categoryLabels: Record<Category, string> = {
  url: "🔗 URLs",
  email: "📧 Emails",
  error: "⚠️ Errors",
  code: "💻 Code",
  command: "⚡ Commands",
  ip: "🌐 IP Addresses",
  path: "📁 Paths",
  misc: "📝 Misc",
};

export function SearchBar({ onSearch, onClear }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "">("");
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() || selectedCategory) {
        const filters: SearchFilters = {};
        if (selectedCategory) {
          filters.category = selectedCategory;
        }
        onSearch(query.trim() || "*", filters); // Use "*" for match-all when no query
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClear = () => {
    setQuery("");
    setSelectedCategory("");
    setShowFilters(false);
    onClear();
  };

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-xl">🔍</span>
        <input
          type="text"
          placeholder="Search clipboard history..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-[var(--bg-primary)] text-[var(--text-primary)] px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        {(query || selectedCategory) && (
          <button
            onClick={handleClear}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm px-2"
            title="Clear search"
          >
            ✕
          </button>
        )}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
            showFilters || selectedCategory
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          title="Filters"
        >
          ⚙️
        </button>
      </div>

      {showFilters && (
        <div className="px-4 pb-3">
          <label className="block text-xs text-[var(--text-secondary)] mb-2">
            Filter by category:
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                selectedCategory === ""
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedCategory === cat
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
