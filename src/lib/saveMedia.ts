import { isNative } from './platform';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Save a captured photo/video to the device.
 * Web: browser download. Native: write to cache and open the system share
 * sheet ("Save to Photos" / "Save to device" / any app).
 */
export async function saveMedia(blob: Blob, filename: string): Promise<'saved' | 'shared' | 'cancelled'> {
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'saved';
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await blobToBase64(blob);
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  try {
    await Share.share({ title: 'SUMANOVA', files: [uri] });
    return 'shared';
  } catch {
    return 'cancelled';
  }
}
