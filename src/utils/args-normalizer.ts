/**
 * Normalizes CLI argument flags for backward compatibility.
 * Replaces shorthand multi-letter flags (-ou, -ds, -pe) and double-dash aliases (--ou, --ds, --pe)
 * with standard long option names (--parentOrgUnit, --dataSet, --periods).
 * Also strips standalone "--" passed by package managers/runners like pnpm/npm/tsx.
 */
export function normalizeArgs(args: string[]): string[] {
  const filtered = args.filter((arg, i) => !(i >= 2 && arg === '--'));
  return filtered.map((arg) => {
    if (arg.startsWith('-ou=') || arg.startsWith('--ou=')) {
      return arg.replace(/^--?ou=/, '--parentOrgUnit=');
    }
    if (arg === '-ou' || arg === '--ou') return '--parentOrgUnit';
    if (arg.startsWith('-ds=') || arg.startsWith('--ds=')) {
      return arg.replace(/^--?ds=/, '--dataSet=');
    }
    if (arg === '-ds' || arg === '--ds') return '--dataSet';
    if (arg.startsWith('-pe=') || arg.startsWith('--pe=')) {
      return arg.replace(/^--?pe=/, '--periods=');
    }
    if (arg === '-pe' || arg === '--pe') return '--periods';
    if (arg.startsWith('-lvl=') || arg.startsWith('--lvl=') || arg.startsWith('-level=')) {
      return arg.replace(/^--?(lvl|level)=/, '--level=');
    }
    if (arg === '-lvl' || arg === '--lvl' || arg === '-level') return '--level';
    if (arg.startsWith('-lu=') || arg.startsWith('--lu=')) {
      return arg.replace(/^--?lu=/, '--lastUpdated=');
    }
    if (arg === '-lu' || arg === '--lu') return '--lastUpdated';
    return arg;
  });
}
