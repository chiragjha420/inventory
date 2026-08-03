/**
 * Compresses an image file client-side using Canvas.
 * Resizes the image to fit within maxWidth and maxHeight (maintaining aspect ratio),
 * and compresses it to a JPEG blob with the specified quality.
 * 
 * @param file The original image file from input
 * @param maxWidth Max width of the output image (default 800)
 * @param maxHeight Max height of the output image (default 800)
 * @param quality Compression quality from 0 to 1 (default 0.8)
 * @returns A promise resolving to a Blob containing the compressed image
 */
export async function compressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Only compress image files
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio and new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D context from canvas'));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas content to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image (Canvas toBlob returned null)'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => {
        reject(new Error('Failed to load image element: ' + err.toString()));
      };
    };
    reader.onerror = (err) => {
      reject(new Error('Failed to read image file: ' + err.toString()));
    };
  });
}
