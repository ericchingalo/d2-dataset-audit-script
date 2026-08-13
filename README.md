# DHIS2 Dataset Audit Excel Generator

A TypeScript Node.js CLI tool built with `pnpm` that fetches dataset values and audit logs from a DHIS2 instance, merges update audit histories with filled data values, and generates a formatted Excel report grouped into district sheets.

## Features

- **District Grouping**: Grouped into Excel sheets based on level 4 districts under a specified parent organisation unit.
- **Audit History Merging**: Combines current data values with audit history (`UPDATE` audit types) to reconstruct the modification trail.
- **Filtered Output**: Includes only data elements and values that have audit update history.
- **Sorted Data**: Rows within each sheet are sorted by **Period** (descending), **Data Element Name** (alphabetically), and **Disaggregation**.
- **Dynamic Excel Layout**:
  - Auto-calculated dynamic horizontal columns for audit history: `Previous Value 1`, `Edited By (Prev 1)`, `Date (Prev 1)`, `Previous Value 2`, `Edited By (Prev 2)`, `Date (Prev 2)`, etc.
  - Formatted headers, frozen top pane, and auto-adjusted column widths.
  - Automated sheet name sanitization (31-character limit and character cleanup).

- **Dataset Value Reverting**: Automatically inspects audit history for modified data value cells, targets the previous latest value (`history[0].value`), and posts updates back to DHIS2 via `api/dataValueSets`.
- **Dry-Run Mode**: Allows previewing revert candidates before executing network posts to DHIS2.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **pnpm**: v8.0.0 or higher

---

## Installation

Clone the repository and install dependencies using `pnpm`:

```bash
pnpm install
```

---

## Configuration

Copy `.env.example` to create a `.env` file in the project root:

```bash
cp .env.example .env
```

Configure your DHIS2 credentials in `.env`:

```env
# DHIS2 Server Configuration
DHIS2_BASE_URL=https://your-dhis2-instance.org

# Basic Auth Credentials
DHIS2_USERNAME=admin
DHIS2_PASSWORD=district

# Or Personal Access Token (PAT)
# DHIS2_PAT_TOKEN=d2pat_xxxxxx
```

---

## Usage

The CLI supports two subcommands:

1. **`audit`** (default): Generates the Excel audit report.
2. **`revert`**: Reverts dataset values to their previous latest state before modifications.

### Command Syntax

```bash
# Audit command (default)
pnpm start audit -p <parentOrgUnitId> -d <dataSetId> -e <periods> [-o <outputFilename>]

# Revert command (with optional --dry-run)
pnpm start revert -p <parentOrgUnitId> -d <dataSetId> -e <periods> [--dry-run]
```

OR with long form of the options:

```
# Audit command (default)
pnpm start audit --parentOrgUnit <parentOrgUnitId> --dataSet <dataSetId> --periods <periods> [--output <outputFilename>]

# Revert command (with optional --dry-run)
pnpm start revert --parentOrgUnit <parentOrgUnitId> --dataSet <dataSetId> --periods <periods> [--dry-run]
```

### CLI Options

| Option            | Shorthand | Required (Audit/Revert) | Description                                                               |
| :---------------- | :-------- | :---------------------- | :------------------------------------------------------------------------ |
| `--parentOrgUnit` | `-p`      | **Yes**                 | Parent Organisation Unit ID (fetches level 4 districts under this parent) |
| `--dataSet`       | `-d`      | **Yes**                 | DHIS2 Dataset ID                                                          |
| `--periods`       | `-e`      | **Yes**                 | Comma-separated list of periods (e.g. `2026` or `202601,202602`)          |
| `--output`        | `-o`      | No (Audit only)         | Output Excel file path (default: `dataset_audit_report.xlsx`)             |
| `--baseUrl`       |           | No                      | DHIS2 Base URL (overrides `DHIS2_BASE_URL` in `.env`)                     |
| `--dry-run`       |           | No (Revert only)        | Preview values to revert without posting changes to DHIS2                 |
| `--help`          | `-h`      | No                      | Display CLI help menu                                                     |

### Example Commands

#### Audit Command (Single or Multiple Periods)

```bash
pnpm start audit -p QuGXmXjGx2o -d WqMbv5DkReA -e 2026 -o audit_report_2026.xlsx
pnpm start -p QuGXmXjGx2o -d WqMbv5DkReA -e 202601,202602,202603 # audit is default
```

#### Revert Command

```bash
# Preview values to be reverted without making changes in DHIS2
pnpm start revert -p QuGXmXjGx2o -d WqMbv5DkReA -e 2026 --dry-run

# Revert edited data values to previous state in DHIS2
pnpm start revert -p QuGXmXjGx2o -d WqMbv5DkReA -e 2026
```

---

## Development & Testing

### Build TypeScript

Compiles TypeScript files in `src/` to `dist/`:

```bash
pnpm build
```

### Run Unit Tests

Executes unit tests using `vitest`:

```bash
pnpm test
```

---

## Excel Structure

Each district gets its own sheet in the generated Excel report.

| Column Header           | Description                                             |
| :---------------------- | :------------------------------------------------------ |
| **Data Element**        | Name of the DHIS2 Data Element (sorted alphabetically)  |
| **Disaggregation**      | Category Option Combo name (e.g. `< 5 Years`, `Male`)   |
| **Period**              | DHIS2 Period ID (e.g. `2026`, `202601`)                 |
| **Current Value**       | Latest stored data value                                |
| **Modified By**         | Username of person who last updated the value           |
| **Last Updated**        | Timestamp of the latest modification                    |
| **Previous Value 1**    | Immediate prior value before latest edit                |
| **Edited By (Prev 1)**  | Username who performed Previous Edit 1                  |
| **Date (Prev 1)**       | Timestamp of Previous Edit 1                            |
| **Previous Value 2...** | Older values ordered chronologically (newest to oldest) |

---

## License

ISC
