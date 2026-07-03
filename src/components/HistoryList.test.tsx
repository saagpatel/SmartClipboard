/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ClipboardItem } from "../types";
import { HistoryList } from "./HistoryList";

const mockGetHistory = vi.fn();
const mockSearch = vi.fn();
const mockCopyToClipboard = vi.fn();
const mockSetFavorite = vi.fn();
const mockDeleteItem = vi.fn();
const mockHide = vi.fn();

vi.mock("../lib/ipc", () => ({
  getHistory: (...args: unknown[]) => mockGetHistory(...args),
  search: (...args: unknown[]) => mockSearch(...args),
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
  setFavorite: (...args: unknown[]) => mockSetFavorite(...args),
  deleteItem: (...args: unknown[]) => mockDeleteItem(...args),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ hide: mockHide }),
}));

vi.mock("./SearchBar", () => ({
  SearchBar: ({
    onSearch,
    onClear,
  }: {
    onSearch: (query: string, filters: Record<string, string>) => void;
    onClear: () => void;
  }) => (
    <div>
      <button onClick={() => onSearch("query", { category: "code" })}>trigger-search</button>
      <button onClick={onClear}>trigger-clear</button>
    </div>
  ),
}));

vi.mock("./HistoryItem", () => ({
  HistoryItem: ({
    item,
    isSelected,
    onToggleFavorite,
  }: {
    item: ClipboardItem;
    isSelected: boolean;
    onToggleFavorite: (id: number, isFavorite: boolean) => void;
  }) => (
    <div data-testid={`item-${item.id}`} data-selected={isSelected ? "true" : "false"}>
      <span>{item.preview}</span>
      <button data-testid={`fav-${item.id}`} onClick={() => onToggleFavorite(item.id, item.isFavorite)}>
        favorite
      </button>
    </div>
  ),
}));

vi.mock("./EmptyState", () => ({
  EmptyState: () => <div>empty</div>,
}));

vi.mock("./DetailView", () => ({
  DetailView: () => <div>detail</div>,
}));

function makeItem(id: number, preview: string): ClipboardItem {
  return {
    id,
    content: preview,
    contentType: "text",
    imagePath: null,
    category: "code",
    sourceApp: "Tests",
    preview,
    copiedAt: 1_700_000_000,
    isFavorite: false,
    isSensitive: false,
    hash: `hash-${id}`,
  };
}

describe("HistoryList", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFavorite.mockResolvedValue(undefined);
    mockDeleteItem.mockResolvedValue(undefined);
    mockCopyToClipboard.mockResolvedValue(undefined);
    mockHide.mockResolvedValue(undefined);
  });

  it("keeps active filters when refreshing after favorite toggle", async () => {
    const items = [makeItem(1, "first")];
    mockGetHistory.mockResolvedValue(items);
    mockSearch.mockResolvedValue(items);

    render(<HistoryList />);

    await waitFor(() => expect(screen.getByTestId("item-1")).toBeTruthy());

    fireEvent.click(screen.getByText("trigger-search"));

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith("query", { category: "code" }, 100);
    });

    fireEvent.click(screen.getByTestId("fav-1"));

    await waitFor(() => {
      expect(mockSearch).toHaveBeenLastCalledWith("query", { category: "code" }, 100);
    });
  });

  it("uses latest item list for keyboard navigation and Enter copy", async () => {
    const initialItems = [makeItem(1, "only")];
    const searchedItems = [makeItem(1, "only"), makeItem(2, "second")];

    mockGetHistory.mockResolvedValue(initialItems);
    mockSearch.mockResolvedValue(searchedItems);

    render(<HistoryList />);

    await waitFor(() => expect(screen.getByTestId("item-1")).toBeTruthy());

    fireEvent.click(screen.getByText("trigger-search"));
    await waitFor(() => expect(screen.getByTestId("item-2")).toBeTruthy());

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    await waitFor(() => {
      expect(mockCopyToClipboard).toHaveBeenCalledWith(2);
    });
  });
});
