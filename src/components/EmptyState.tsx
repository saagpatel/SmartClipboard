export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="text-6xl mb-4">📋</div>
      <h2 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">
        No clipboard history yet
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Copy something to get started!
      </p>
      <p className="text-xs text-[var(--text-secondary)]">
        Keyboard shortcut: <kbd className="px-2 py-1 bg-[var(--bg-secondary)] rounded">⌘⇧V</kbd>
      </p>
    </div>
  );
}
