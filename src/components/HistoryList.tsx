import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardItem, SearchFilters } from "../types";
import { getHistory, search, copyToClipboard, setFavorite, deleteItem } from "../lib/ipc";
import { HistoryItem as HistoryItemComponent } from "./HistoryItem";
import { EmptyState } from "./EmptyState";
import { SearchBar } from "./SearchBar";
import { DetailView } from "./DetailView";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function HistoryList() {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [detailItem, setDetailItem] = useState<ClipboardItem | null>(null);

  const itemsRef = useRef<ClipboardItem[]>([]);
  const selectedIndexRef = useRef(0);
  const isSearchingRef = useRef(false);
  const searchQueryRef = useRef("");
  const searchFiltersRef = useRef<SearchFilters>({});

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    isSearchingRef.current = isSearching;
  }, [isSearching]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    searchFiltersRef.current = searchFilters;
  }, [searchFilters]);

  const loadHistory = useCallback(async () => {
    try {
      const history = await getHistory(100, 0);
      setItems(history);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCopy = useCallback(async (id: number) => {
    try {
      await copyToClipboard(id);
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  }, []);

  const handleSearch = useCallback(async (query: string, filters: SearchFilters) => {
    setIsSearching(true);
    setSearchQuery(query);
    setSearchFilters(filters);
    try {
      const results = await search(query, filters, 100);
      setItems(results);
    } catch (error) {
      console.error("Failed to search:", error);
    }
  }, []);

  const refreshCurrentView = useCallback(async () => {
    if (isSearchingRef.current && searchQueryRef.current) {
      await handleSearch(searchQueryRef.current, searchFiltersRef.current);
    } else {
      await loadHistory();
    }
  }, [handleSearch, loadHistory]);

  useEffect(() => {
    if (!isSearching) {
      void loadHistory();

      // Poll for new items every 2 seconds (only when not searching)
      const interval = setInterval(() => {
        void loadHistory();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isSearching, loadHistory]);

  useEffect(() => {
    // Reset selection when items change
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    // Keyboard navigation
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't interfere with input typing
      if ((e.target as HTMLElement).tagName === "INPUT") {
        if (e.key === "Escape") {
          (e.target as HTMLInputElement).blur();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, Math.max(itemsRef.current.length - 1, 0))
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const currentItems = itemsRef.current;
        const currentIndex = selectedIndexRef.current;
        if (currentItems.length > 0 && currentItems[currentIndex]) {
          void handleCopy(currentItems[currentIndex].id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        const appWindow = getCurrentWindow();
        await appWindow.hide();
      } else if (e.key === "/" || (e.metaKey && e.key === "f")) {
        e.preventDefault();
        // Focus search input
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCopy]);

  const handleClearSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
    setSearchFilters({});
    void loadHistory();
  };

  const handleToggleFavorite = async (id: number, isFavorite: boolean) => {
    try {
      await setFavorite(id, isFavorite);
      await refreshCurrentView();
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteItem(id);
      await refreshCurrentView();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  // Show detail view if an item is selected
  if (detailItem) {
    return (
      <DetailView
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onCopy={handleCopy}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <SearchBar onSearch={handleSearch} onClear={handleClearSearch} />

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          {isSearching ? (
            <div className="text-center px-8">
              <p className="text-lg mb-2 text-[var(--text-primary)]">No results found</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Try a different search term or clear filters
              </p>
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollable">
          {isSearching && (
            <div className="px-4 py-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-b border-[var(--border)]">
              Found {items.length} result{items.length !== 1 ? "s" : ""}
            </div>
          )}
          {items.map((item, index) => (
            <HistoryItemComponent
              key={item.id}
              item={item}
              isSelected={index === selectedIndex}
              onCopy={handleCopy}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDelete}
              onShowDetails={setDetailItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
