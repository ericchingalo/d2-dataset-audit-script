import fs from "fs";
import path from "path";
import lodash from "lodash";
import {
  IRevertService,
  RevertOptions,
  RevertResult,
} from "../interfaces/revert-service.interface.js";
import {
  IDhis2ApiClient,
  Dhis2ClientConfig,
} from "../interfaces/dhis2-client.interface.js";
import { Dhis2ApiClient } from "./dhis2-api.js";
import { DataValue } from "../types/dhis2.js";
import { generateImportReport } from "../utils/import-report.js";
import { readAuditReportExcel } from "./excel-reader.js";
import {
  formatPrefixedOutputPath,
  resolveOutputPath,
} from "../utils/path-resolver.js";
import { sanitizeSheetName } from "./excel-exporter.js";

export type Dhis2ClientFactory = (config: Dhis2ClientConfig) => IDhis2ApiClient;

export class RevertService implements IRevertService {
  private clientFactory: Dhis2ClientFactory;

  constructor(clientFactory?: Dhis2ClientFactory) {
    this.clientFactory =
      clientFactory ||
      ((config: Dhis2ClientConfig) => new Dhis2ApiClient(config));
  }

  async execute(options: RevertOptions): Promise<RevertResult> {
    console.log("--- DHIS2 Dataset Value Revert ---");
    if (options.baseUrl) {
      console.log(`Base URL:       ${options.baseUrl}`);
    }
    const parentOrgUnits = Array.isArray(options.parentOrgUnit)
      ? options.parentOrgUnit.map((id) => id.trim()).filter(Boolean)
      : (options.parentOrgUnit || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);

    if (parentOrgUnits.length > 0) {
      console.log(`Parent OrgUnit: ${parentOrgUnits.join(", ")}`);
    }
    if (options.dataSet) {
      console.log(`DataSet ID:     ${options.dataSet}`);
    }
    if (options.periods && options.periods.length > 0) {
      console.log(`Periods:        ${options.periods.join(", ")}`);
    }
    if (options.lastUpdated) {
      console.log(`Last Updated:   >= ${options.lastUpdated}`);
    }
    if (options.level !== undefined) {
      console.log(`OrgUnit Level:  ${options.level}`);
    } else {
      console.log(`OrgUnit Level:  Not specified (targeting parent org unit)`);
    }
    if (options.dryRun) {
      console.log(`Mode:           DRY RUN (No data will be posted to DHIS2)`);
    }
    console.log(
      "\n[Revert] Process initiated. Reverting dataset changes using generated report files...\n",
    );

    if (
      !options.baseUrl ||
      parentOrgUnits.length === 0 ||
      !options.dataSet ||
      !options.periods ||
      options.periods.length === 0
    ) {
      console.warn(
        "[Warning] Missing required options for revert operation (baseUrl, parentOrgUnit, dataSet, or periods).",
      );
      return {
        totalReverted: 0,
        orgUnitsProcessed: 0,
        status: "SKIPPED",
      };
    }

    const prefix = `${parentOrgUnits.join("_")}_${options.periods.join("-")}_`;
    const filesToRead: string[] = [];

    if (options.output) {
      const prefixedTarget = formatPrefixedOutputPath(
        options.output,
        parentOrgUnits,
        options.periods,
      );
      if (fs.existsSync(prefixedTarget)) {
        filesToRead.push(prefixedTarget);
      } else {
        const rawResolved = resolveOutputPath(options.output);
        if (fs.existsSync(rawResolved)) {
          filesToRead.push(rawResolved);
        } else if (fs.existsSync(options.output)) {
          filesToRead.push(options.output);
        } else {
          console.error(
            `Error: Specified output file not found: ${prefixedTarget} or ${options.output}`,
          );
          return {
            totalReverted: 0,
            orgUnitsProcessed: 0,
            status: "FILE_NOT_FOUND",
          };
        }
      }
    } else {
      const outputDir = path.dirname(resolveOutputPath("dummy.xlsx"));
      if (fs.existsSync(outputDir)) {
        const allFiles = fs.readdirSync(outputDir);
        for (const file of allFiles) {
          if (file.startsWith(prefix) && file.endsWith(".xlsx")) {
            filesToRead.push(path.join(outputDir, file));
          }
        }
      }

      if (filesToRead.length === 0) {
        console.error(
          `Error: No audit report files found matching prefix "${prefix}*.xlsx" in output/ directory. Run audit command first.`,
        );
        return {
          totalReverted: 0,
          orgUnitsProcessed: 0,
          status: "NO_FILES",
        };
      }
    }

    console.log(
      `Found ${filesToRead.length} matching audit report file(s) to revert from:`,
    );
    filesToRead.forEach((f) => console.log(` - ${f}`));
    console.log("");

    const client = this.clientFactory({
      baseUrl: options.baseUrl,
      username: options.username,
      password: options.password,
      patToken: options.patToken,
    });

    console.log(
      "Fetching organisation units and dataset metadata for ID mapping...",
    );
    const orgUnitsPromise =
      options.level !== undefined
        ? Promise.all(
            parentOrgUnits.map((parentId) =>
              client.getOrgUnitsByLevel(parentId, options.level!)
            )
          ).then((lists) => {
            const all = lists.flat();
            const seen = new Set<string>();
            return all.filter((ou) => {
              if (seen.has(ou.id)) return false;
              seen.add(ou.id);
              return true;
            });
          })
        : Promise.all(
            parentOrgUnits.map((parentId) => client.getOrgUnitById(parentId))
          ).then((ous) => {
            const seen = new Set<string>();
            return ous.filter((ou) => {
              if (seen.has(ou.id)) return false;
              seen.add(ou.id);
              return true;
            });
          });

    const [districts, dataSetMeta, cocMap] = await Promise.all([
      orgUnitsPromise,
      client.getDataSetMeta(options.dataSet),
      client.getCategoryOptionCombos(),
    ]);

    const dataElementNameToIdMap: Record<string, string> = {};
    if (dataSetMeta.dataSetElements) {
      for (const dse of dataSetMeta.dataSetElements) {
        if (dse.dataElement) {
          dataElementNameToIdMap[dse.dataElement.name.trim().toLowerCase()] =
            dse.dataElement.id;
        }
      }
    }

    const cocNameToIdMap: Record<string, string> = {};
    for (const [id, name] of Object.entries(cocMap)) {
      cocNameToIdMap[name.trim().toLowerCase()] = id;
    }

    const orgUnitNameToIdMap: Record<string, string> = {};
    const existingSheetNames = new Set<string>();
    for (const ou of districts) {
      orgUnitNameToIdMap[ou.name.trim().toLowerCase()] = ou.id;
      const sanitized = sanitizeSheetName(ou.name, existingSheetNames);
      orgUnitNameToIdMap[sanitized.trim().toLowerCase()] = ou.id;
    }

    const valuesToRevert: DataValue[] = [];
    const processedOrgUnitIds = new Set<string>();

    for (const filePath of filesToRead) {
      console.log(`Reading report file: ${filePath}...`);
      const parsedRows = await readAuditReportExcel(filePath);

      for (const row of parsedRows) {
        if (options.lastUpdated) {
          if (!row.lastUpdated) {
            continue;
          }
          const rowDateStr = row.lastUpdated.slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(rowDateStr)) {
            if (rowDateStr < options.lastUpdated) {
              continue;
            }
          } else {
            const rowTime = new Date(row.lastUpdated).getTime();
            const filterTime = new Date(
              `${options.lastUpdated}T00:00:00Z`,
            ).getTime();
            if (isNaN(rowTime) || rowTime < filterTime) {
              continue;
            }
          }
        }

        const deId = dataElementNameToIdMap[row.dataElementName.toLowerCase()];
        const ouId = orgUnitNameToIdMap[row.orgUnitName.toLowerCase()];
        const cocId = cocNameToIdMap[row.disaggregationName.toLowerCase()];

        if (!deId) {
          console.warn(
            `[Warning] Unmapped Data Element name: "${row.dataElementName}"`,
          );
          continue;
        }
        if (!ouId) {
          console.warn(
            `[Warning] Unmapped Org Unit sheet name: "${row.orgUnitName}"`,
          );
          continue;
        }

        processedOrgUnitIds.add(ouId);

        console.log(
          `  [Revert candidate] DE: ${row.dataElementName} (${deId}) | Period: ${row.period} | Current: "${row.currentValue}" -> Revert to: "${row.previousValue}"`,
        );

        valuesToRevert.push({
          dataElement: deId,
          period: row.period,
          orgUnit: ouId,
          categoryOptionCombo: cocId && cocId !== "default" ? cocId : undefined,
          value: row.previousValue,
          comment: `Reverted to previous value from ${row.currentValue} after dataset audit`,
        });
      }
    }

    if (valuesToRevert.length === 0) {
      console.log(
        "\n[Revert] No edited dataset values with Previous Value 1 found in report file(s).",
      );
      return {
        totalReverted: 0,
        orgUnitsProcessed: processedOrgUnitIds.size,
        status: "NO_CHANGES",
      };
    }

    console.log(
      `\nFound ${valuesToRevert.length} value(s) to revert across ${processedOrgUnitIds.size} org unit(s).`,
    );

    if (options.dryRun) {
      const report = generateImportReport({
        totalReverted: valuesToRevert.length,
        orgUnitsProcessed: processedOrgUnitIds.size,
        dryRun: true,
      });
      console.log("\n" + report);
      return {
        totalReverted: valuesToRevert.length,
        orgUnitsProcessed: processedOrgUnitIds.size,
        status: "DRY_RUN",
      };
    }

    const BATCH_SIZE = 100;
    const chunks = lodash.chunk(valuesToRevert, BATCH_SIZE);
    console.log(
      `\nPosting ${valuesToRevert.length} reverted value(s) in ${chunks.length} batch(es) of up to ${BATCH_SIZE} item(s)...`,
    );

    const aggregatedSummary: any = {
      status: "SUCCESS",
      importCount: {
        imported: 0,
        updated: 0,
        ignored: 0,
        deleted: 0,
      },
      conflicts: [],
    };

    const descriptions: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(
        `  [Batch ${i + 1}/${chunks.length}] Posting ${chunk.length} value(s) to DHIS2 (api/dataValueSets)...`,
      );
      try {
        const rawSummary = await client.postDataValueSets({
          dataSet: options.dataSet,
          dataValues: chunk,
        });
        const chunkSummary = rawSummary?.response || rawSummary;

        if (chunkSummary?.status === "ERROR") {
          aggregatedSummary.status = "ERROR";
        } else if (
          chunkSummary?.status === "WARNING" &&
          aggregatedSummary.status !== "ERROR"
        ) {
          aggregatedSummary.status = "WARNING";
        }

        if (chunkSummary?.importCount && aggregatedSummary.importCount) {
          aggregatedSummary.importCount.imported +=
            chunkSummary.importCount.imported || 0;
          aggregatedSummary.importCount.updated +=
            chunkSummary.importCount.updated || 0;
          aggregatedSummary.importCount.ignored +=
            chunkSummary.importCount.ignored || 0;
          aggregatedSummary.importCount.deleted +=
            chunkSummary.importCount.deleted || 0;
        }

        if (chunkSummary?.conflicts && chunkSummary.conflicts.length > 0) {
          aggregatedSummary.conflicts!.push(...chunkSummary.conflicts);
        }

        if (chunkSummary?.description) {
          descriptions.push(chunkSummary.description);
        }
      } catch (error) {
        aggregatedSummary.status = "ERROR";
        console.error(
          `  [Error] Batch ${i + 1}/${chunks.length} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (descriptions.length > 0) {
      aggregatedSummary.description = lodash.uniq(descriptions).join("; ");
    }

    const report = generateImportReport({
      totalReverted: valuesToRevert.length,
      orgUnitsProcessed: processedOrgUnitIds.size,
      importSummary: aggregatedSummary,
      dryRun: false,
    });
    console.log("\n" + report);

    return {
      totalReverted: valuesToRevert.length,
      orgUnitsProcessed: processedOrgUnitIds.size,
      status: aggregatedSummary.status || "SUCCESS",
      importSummary: aggregatedSummary,
    };
  }
}
