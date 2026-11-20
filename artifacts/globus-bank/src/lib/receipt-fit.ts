export type ReceiptFit = {
  scale: number;
  height: number;
  availableHeight: number;
  maxDialogHeight: number;
};

export function calculateReceiptFit(
  documentHeight: number,
  actionHeight: number,
  viewportHeight: number,
): ReceiptFit {
  const maxDialogHeight = Math.max(
    0,
    Math.min(viewportHeight * 0.8, viewportHeight - 24),
  );
  const availableHeight = Math.max(0, maxDialogHeight - actionHeight - 8);
  if (documentHeight <= 0 || viewportHeight <= 0) {
    return { scale: 0, height: 0, availableHeight, maxDialogHeight };
  }
  const scale = Math.min(0.86, availableHeight / documentHeight);
  return {
    scale,
    height: Math.floor(documentHeight * scale),
    availableHeight,
    maxDialogHeight,
  };
}
