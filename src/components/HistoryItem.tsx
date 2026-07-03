import type { ClipboardItem, Category } from "../types";
import { useState, useEffect } from "react";
import { getImageData } from "../lib/ipc";

interface HistoryItemProps {
  item: ClipboardItem;
  isSelected: boolean;
  onCopy: (id: number) => void;
  onToggleFavorite: (id: number, isFavorite: boolean) => void;
  onDelete: (id: number) => void;
  onShowDetails?: (item: ClipboardItem) => void;
}

const categoryIcons: Record<Category, string> = {
  url: "🔗",
  email: "📧",
  error: "⚠️",
  code: "💻",
  command: "⚡",
  ip: "🌐",
  path: "📁",
  misc: "📝",
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function HistoryItem({
  item,
  isSelected,
  onCopy,
  onToggleFavorite,
  onDelete,
  onShowDetails,
}: HistoryItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    // Load image thumbnail if this is an image item
    if (item.contentType === "image" && item.imagePath) {
      let isMounted = true;
      getImageData(item.imagePath)
        .then((bytes) => {
          if (isMounted) {
            const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
            const url = URL.createObjectURL(blob);
            setImageSrc(url);
          }
        })
        .catch((err) => console.error("Failed to load image:", err));

      return () => {
        isMounted = false;
        setImageSrc((currentSrc) => {
          if (currentSrc) {
            URL.revokeObjectURL(currentSrc);
          }
          return null;
        });
      };
    }
  }, [item.contentType, item.imagePath]);

  const handleClick = (e: React.MouseEvent) => {
    // Cmd+click or double-click to show details
    if ((e.metaKey || e.detail === 2) && onShowDetails) {
      onShowDetails(item);
    } else {
      onCopy(item.id);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(item.id, !item.isFavorite);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
        ${isSelected ? "bg-[var(--bg-hover)]" : "bg-[var(--bg-secondary)]"}
        ${isHovered ? "bg-[var(--bg-hover)]" : ""}
        border-b border-[var(--border)]
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {item.contentType === "image" && imageSrc ? (
        <img
          src={imageSrc}
          alt="Clipboard thumbnail"
          className="w-12 h-12 object-cover rounded flex-shrink-0"
        />
      ) : (
        <span className="text-2xl flex-shrink-0">
          {item.contentType === "image" ? "🖼️" : categoryIcons[item.category]}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate">
          {item.preview}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          {item.sourceApp} · {formatRelativeTime(item.copiedAt)}
        </p>
      </div>

      {(isHovered || item.isFavorite) && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleFavoriteClick}
            className="text-xl hover:scale-110 transition-transform"
            title={item.isFavorite ? "Unpin" : "Pin"}
          >
            {item.isFavorite ? "⭐" : "☆"}
          </button>
          {isHovered && (
            <button
              onClick={handleDeleteClick}
              className="text-xl hover:scale-110 transition-transform"
              title="Delete"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
