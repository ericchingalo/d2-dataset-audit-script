import { describe, it, expect } from 'vitest';
import { generateImportReport } from '../src/utils/import-report.js';

describe('generateImportReport', () => {
  it('formats import summary correctly for successful import', () => {
    const report = generateImportReport({
      totalReverted: 5,
      orgUnitsProcessed: 2,
      importSummary: {
        status: 'SUCCESS',
        description: 'Import process finished',
        importCount: {
          imported: 1,
          updated: 4,
          ignored: 0,
          deleted: 0,
        },
      },
    });

    expect(report).toContain('DHIS2 DATA VALUE IMPORT SUMMARY REPORT');
    expect(report).toContain('Status:              SUCCESS');
    expect(report).toContain('Total Submitted:     5 value(s)');
    expect(report).toContain('Districts Processed: 2 district(s)');
    expect(report).toContain('Imported (new):  1');
    expect(report).toContain('Updated:         4');
    expect(report).toContain('Conflicts / Warnings: (None)');
  });

  it('formats import summary with conflicts and warnings', () => {
    const report = generateImportReport({
      totalReverted: 3,
      orgUnitsProcessed: 1,
      importSummary: {
        status: 'WARNING',
        importCount: {
          imported: 0,
          updated: 2,
          ignored: 1,
          deleted: 0,
        },
        conflicts: [
          { object: 'de1.coc1', value: 'Value out of valid range' },
        ],
      },
    });

    expect(report).toContain('Status:              WARNING');
    expect(report).toContain('Ignored:         1');
    expect(report).toContain('Conflicts / Warnings (1):');
    expect(report).toContain('- [de1.coc1] Value out of valid range');
  });

  it('formats dry run mode correctly', () => {
    const report = generateImportReport({
      totalReverted: 10,
      orgUnitsProcessed: 3,
      dryRun: true,
    });

    expect(report).toContain('Mode:                DRY RUN (Preview mode)');
    expect(report).toContain('Candidate Values:    10');
    expect(report).toContain('Notice:              No network requests were sent to DHIS2.');
  });
});
