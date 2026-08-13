import { DataValueImportSummary } from '../types/dhis2.js';

export interface ImportReportOptions {
  totalReverted: number;
  orgUnitsProcessed: number;
  importSummary?: DataValueImportSummary;
  dryRun?: boolean;
}

export function generateImportReport(options: ImportReportOptions): string {
  const lines: string[] = [];
  lines.push('=====================================================');
  lines.push('          DHIS2 DATA VALUE IMPORT SUMMARY REPORT     ');
  lines.push('=====================================================');

  if (options.dryRun) {
    lines.push(' Mode:                DRY RUN (Preview mode)');
    lines.push(` Candidate Values:    ${options.totalReverted}`);
    lines.push(` Districts Checked:   ${options.orgUnitsProcessed}`);
    lines.push(' Status:              SKIPPED_POSTING');
    lines.push(' Notice:              No network requests were sent to DHIS2.');
  } else {
    const summary = options.importSummary;
    const status = summary?.status || 'UNKNOWN';
    const counts = summary?.importCount;

    lines.push(` Status:              ${status}`);
    lines.push(` Total Submitted:     ${options.totalReverted} value(s)`);
    lines.push(` Districts Processed: ${options.orgUnitsProcessed} district(s)`);

    if (summary?.description) {
      lines.push(` Description:         ${summary.description}`);
    }

    lines.push('');
    lines.push(' Import Statistics:');
    lines.push(`   • Imported (new):  ${counts?.imported ?? 0}`);
    lines.push(`   • Updated:         ${counts?.updated ?? 0}`);
    lines.push(`   • Ignored:         ${counts?.ignored ?? 0}`);
    lines.push(`   • Deleted:         ${counts?.deleted ?? 0}`);

    lines.push('');
    if (summary?.conflicts && summary.conflicts.length > 0) {
      lines.push(` Conflicts / Warnings (${summary.conflicts.length}):`);
      for (const conflict of summary.conflicts) {
        const obj = conflict.object ? `[${conflict.object}] ` : '';
        const val = conflict.value || 'Unknown conflict';
        lines.push(`   - ${obj}${val}`);
      }
    } else {
      lines.push(' Conflicts / Warnings: (None)');
    }
  }

  lines.push('=====================================================');
  return lines.join('\n');
}
