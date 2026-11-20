export type ReceiptFileShare = (data: ShareData) => Promise<void>;
export type ReceiptFileCanShare = (data: ShareData) => boolean;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Prefer the device's native share/save sheet for image files. Browsers do not
 * permit a site to write directly into a user's Photos/Gallery without a user
 * choice, so unsupported sharing falls back to a normal file download.
 */
export async function saveReceiptFileToDevice(
  file: File,
  share: ReceiptFileShare | undefined,
  canShare: ReceiptFileCanShare | undefined,
  download: (file: File) => void,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const shareData: ShareData = {
    files: [file],
    title: 'Globus transaction receipt',
  };
  if (share && (!canShare || canShare(shareData))) {
    try {
      await share(shareData);
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
    }
  }
  download(file);
  return 'downloaded';
}
