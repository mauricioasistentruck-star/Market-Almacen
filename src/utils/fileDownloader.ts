import { saveAs } from 'file-saver';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Helper to convert Blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Universal file downloader that works seamlessly on Desktop Web and Android Capacitor (APK)
 */
export async function downloadOrShareBlob(blob: Blob, filename: string, _mimeType?: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      await Share.share({
        title: filename,
        text: `Documento de Bodega Control: ${filename}`,
        url: savedFile.uri,
        dialogTitle: `Abrir o Guardar: ${filename}`
      });
      return;
    } catch (err) {
      console.warn('[downloadOrShareBlob] Native share/save error:', err);
    }
  }

  // Web Browser standard fallback
  saveAs(blob, filename);
}
