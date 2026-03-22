// File upload validation utilities

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate map image upload
 * Max size: 25MB
 * Max dimensions: 5000x5000
 * Allowed formats: PNG, JPG, WEBP
 */
export const validateMapUpload = async (file: File): Promise<ValidationResult> => {
  // Check file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed: PNG, JPG, WEBP',
    };
  }

  // Check file size (25MB max)
  const maxSize = 25 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Map image must be under 25MB',
    };
  }

  // Check dimensions
  try {
    const dimensions = await getImageDimensions(file);
    if (dimensions.width > 5000 || dimensions.height > 5000) {
      return {
        valid: false,
        error: 'Map dimensions must be 5000x5000 pixels or smaller',
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Could not read image dimensions',
    };
  }

  return { valid: true };
};

/**
 * Validate token image upload
 * Max size: 2MB
 * Allowed formats: PNG, JPG, WEBP, GIF
 */
export const validateTokenUpload = (file: File): ValidationResult => {
  // Check file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed: PNG, JPG, WEBP, GIF',
    };
  }

  // Check file size (2MB max)
  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Token image must be under 2MB',
    };
  }

  return { valid: true };
};

/**
 * Validate handout image upload
 * Max size: 10MB
 * Allowed formats: PNG, JPG, WEBP
 */
export const validateHandoutUpload = (file: File): ValidationResult => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed: PNG, JPG, WEBP',
    };
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Handout image must be under 10MB',
    };
  }

  return { valid: true };
};

/**
 * Get image dimensions from file
 */
export const getImageDimensions = (
  file: File
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Validate username
 */
export const validateUsername = (username: string): ValidationResult => {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'Username is required' };
  }

  if (username.length > 50) {
    return { valid: false, error: 'Username must be 50 characters or less' };
  }

  if (username.length < 2) {
    return { valid: false, error: 'Username must be at least 2 characters' };
  }

  return { valid: true };
};

/**
 * Validate session name
 */
export const validateSessionName = (name: string): ValidationResult => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Session name is required' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Session name must be 100 characters or less' };
  }

  if (name.length < 2) {
    return { valid: false, error: 'Session name must be at least 2 characters' };
  }

  return { valid: true };
};
