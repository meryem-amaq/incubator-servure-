/**
 * Utilitaire de compression et redimensionnement d'images côté client
 * Permet de réduire le poids des photos d'atelier (ex: de 10 Mo à ~150 Ko)
 * avant leur transmission au serveur, évitant tout problème de stockage.
 */

export async function compressImage(file, {
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82,
  outputType = 'image/jpeg'
} = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    return file;
  }

  // Ne pas compresser les SVG ou GIF animés
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  // Si le fichier fait déjà moins de 120 Ko, pas besoin de compresser
  if (file.size <= 120 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new window.Image();

      img.onload = () => {
        let { width, height } = img;

        // Calcul des dimensions proportionnelles
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Lissage haute qualité
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // Si la compression n'est pas plus légère, garder l'original
              resolve(file);
            } else {
              const cleanName = (file.name || 'photo').replace(/\.[^/.]+$/, '') + '.jpg';
              const compressedFile = new File([blob], cleanName, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Compresse une liste de fichiers images en parallèle
 */
export async function compressImageList(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) return [];
  return Promise.all(files.map(f => compressImage(f, options)));
}

