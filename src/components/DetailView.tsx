import { useState, useEffect } from "react";
import type { ClipboardItem } from "../types";
import { getImageData } from "../lib/ipc";
import { CodeBlock } from "./CodeBlock";

interface DetailViewProps {
  item: ClipboardItem;
  onClose: () => void;
  onCopy: (id: number) => void;
  onToggleFavorite: (id: number, isFavorite: boolean) => void;
  onDelete: (id: number) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function DetailView({ item, onClose, onCopy, onToggleFavorite, onDelete }: DetailViewProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    // Load full image if this is an image item
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

  const handleCopy = () => {
    onCopy(item.id);
  };

  const handleToggleFavorite = () => {
    onToggleFavorite(item.id, !item.isFavorite);
  };

  const handleDelete = () => {
    if (confirm("Delete this item?")) {
      onDelete(item.id);
      onClose();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl"
            title="Back"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Item Details</h2>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollable p-4 space-y-4">
        {/* Metadata */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Source:</span>
            <span className="text-[var(--text-primary)]">{item.sourceApp}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Category:</span>
            <span className="text-[var(--text-primary)] capitalize">{item.category}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Copied:</span>
            <span className="text-[var(--text-primary)]">{formatDate(item.copiedAt)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Type:</span>
            <span className="text-[var(--text-primary)] capitalize">{item.contentType}</span>
          </div>
        </div>

        {/* Full Content */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            {item.contentType === "image" ? "Image Preview:" : "Full Content:"}
          </label>
          {item.contentType === "image" && imageSrc ? (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4 flex items-center justify-center">
              <img
                src={imageSrc}
                alt="Clipboard image"
                className="max-w-full max-h-80 object-contain rounded"
              />
            </div>
          ) : item.contentType === "image" ? (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4 flex items-center justify-center text-[var(--text-secondary)]">
              Loading image...
            </div>
          ) : item.category === "code" || item.category === "command" ? (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4 overflow-hidden">
              <CodeBlock code={item.content} />
            </div>
          ) : (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4">
              <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words font-mono">
                {item.content}
              </pre>
            </div>
          )}
        </div>

        {/* Stats */}
        {item.contentType === "text" && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3">
              <div className="text-[var(--text-secondary)] mb-1">Length</div>
              <div className="text-[var(--text-primary)] font-semibold">{item.content.length} chars</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3">
              <div className="text-[var(--text-secondary)] mb-1">Lines</div>
              <div className="text-[var(--text-primary)] font-semibold">{item.content.split('\n').length}</div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          onClick={handleCopy}
          className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          📋 Copy to Clipboard
        </button>
        <button
          onClick={handleToggleFavorite}
          className="px-4 py-2 bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
          title={item.isFavorite ? "Unpin" : "Pin"}
        >
          {item.isFavorite ? "⭐" : "☆"}
        </button>
        <button
          onClick={handleDelete}
          className="px-4 py-2 bg-[var(--bg-hover)] text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
