import path from 'path';
import fs from 'fs';

/**
 * Resolves the given target output path so that generated reports are saved
 * inside the project's root `output/` directory by default.
 * Automatically creates any missing parent directories.
 */
export function resolveOutputPath(targetPath: string): string {
  let resolvedPath = targetPath;

  if (!path.isAbsolute(targetPath)) {
    const normalized = path.normalize(targetPath);
    if (
      !normalized.startsWith('output/') &&
      !normalized.startsWith('output\\') &&
      normalized !== 'output'
    ) {
      resolvedPath = path.join('output', targetPath);
    }
  }

  const dir = path.dirname(resolvedPath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return resolvedPath;
}
