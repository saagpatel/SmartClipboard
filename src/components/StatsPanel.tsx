import { useEffect, useState } from "react";
import type { ClipboardItem, Category } from "../types";
import { getHistory } from "../lib/ipc";

interface StatsPanelProps {
  onClose: () => void;
}

interface CategoryStats {
  category: Category;
  count: number;
  percentage: number;
}

export function StatsPanel({ onClose }: StatsPanelProps) {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CategoryStats[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const history = await getHistory(10000, 0); // Get all items for stats
      setItems(history);
      calculateStats(history);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (items: ClipboardItem[]) => {
    const categoryCounts: Record<string, number> = {};

    items.forEach((item) => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });

    const categoryStats: CategoryStats[] = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category: category as Category,
        count,
        percentage: (count / items.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    setStats(categoryStats);
  };

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

  const categoryLabels: Record<Category, string> = {
    url: "URLs",
    email: "Emails",
    error: "Errors",
    code: "Code Snippets",
    command: "Commands",
    ip: "IP Addresses",
    path: "File Paths",
    misc: "Miscellaneous",
  };

  const totalFavorites = items.filter((item) => item.isFavorite).length;
  const totalSize = items.reduce((acc, item) => acc + item.content.length, 0);
  const avgSize = items.length > 0 ? Math.round(totalSize / items.length) : 0;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Statistics</h2>
        <button
          onClick={onClose}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollable p-4 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-[var(--text-secondary)] text-sm mb-1">Total Items</div>
            <div className="text-[var(--text-primary)] text-3xl font-bold">{items.length}</div>
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-[var(--text-secondary)] text-sm mb-1">Favorites</div>
            <div className="text-[var(--text-primary)] text-3xl font-bold">{totalFavorites}</div>
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-[var(--text-secondary)] text-sm mb-1">Total Size</div>
            <div className="text-[var(--text-primary)] text-2xl font-bold">
              {(totalSize / 1024).toFixed(1)} KB
            </div>
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-[var(--text-secondary)] text-sm mb-1">Avg Size</div>
            <div className="text-[var(--text-primary)] text-2xl font-bold">{avgSize} chars</div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
            Items by Category
          </h3>
          <div className="space-y-3">
            {stats.map((stat) => (
              <div
                key={stat.category}
                className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{categoryIcons[stat.category]}</span>
                    <span className="text-sm text-[var(--text-primary)]">
                      {categoryLabels[stat.category]}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {stat.count}
                  </span>
                </div>
                <div className="w-full bg-[var(--bg-hover)] rounded-full h-2">
                  <div
                    className="bg-[var(--accent)] h-2 rounded-full transition-all"
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  {stat.percentage.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
            Recent Activity
          </h3>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Last copied:</span>
                <span className="text-[var(--text-primary)]">
                  {items.length > 0
                    ? new Date(items[0].copiedAt * 1000).toLocaleString()
                    : "Never"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Most common source:</span>
                <span className="text-[var(--text-primary)]">
                  {items.length > 0
                    ? Object.entries(
                        items.reduce((acc, item) => {
                          acc[item.sourceApp] = (acc[item.sourceApp] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).sort((a, b) => b[1] - a[1])[0][0]
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Close
        </button>
      </div>
    </div>
  );
}
