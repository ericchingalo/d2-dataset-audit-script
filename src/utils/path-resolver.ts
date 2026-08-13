import path from 'path';
import fs from 'fs';

export function formatPrefixedOutputPath(
  targetPath: string,
  parentOrgUnit: string,
  periods: string[]
): string {
  const periodStr = periods.join("-");
  const dir = path.dirname(targetPath);
  const fileBasename = path.basename(targetPath);
  const prefixedFilename = `${parentOrgUnit}_${periodStr}_${fileBasename}`;

  const combinedPath = dir && dir !== "." ? path.join(dir, prefixedFilename) : prefixedFilename;
  return resolveOutputPath(combinedPath);
}

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
