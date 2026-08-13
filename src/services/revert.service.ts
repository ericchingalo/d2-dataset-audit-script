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
import { mergeAuditData } from "./audit-merger.js";
import { DataValue, DataValueImportSummary } from "../types/dhis2.js";
import { generateImportReport } from "../utils/import-report.js";

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
    if (options.parentOrgUnit) {
      console.log(`Parent OrgUnit: ${options.parentOrgUnit}`);
    }
    if (options.dataSet) {
      console.log(`DataSet ID:     ${options.dataSet}`);
    }
    if (options.periods && options.periods.length > 0) {
      console.log(`Periods:        ${options.periods.join(", ")}`);
    }
    if (options.dryRun) {
      console.log(`Mode:           DRY RUN (No data will be posted to DHIS2)`);
    }
    console.log(
      "\n[Revert] Process initiated. Reverting dataset changes to previous values...\n",
    );

    if (
      !options.baseUrl ||
      !options.parentOrgUnit ||
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

    const client = this.clientFactory({
      baseUrl: options.baseUrl,
      username: options.username,
      password: options.password,
      patToken: options.patToken,
    });

    console.log("Fetching level 4 district organisation units...");
    const districts = await client.getOrgUnitsByLevel(options.parentOrgUnit, 4);
    console.log(`Found ${districts.length} district(s).\n`);

    if (districts.length === 0) {
      console.warn("No districts found matching criteria.");
      return {
        totalReverted: 0,
        orgUnitsProcessed: 0,
        status: "NO_DISTRICTS",
      };
    }

    console.log(`Fetching dataset metadata for ID: ${options.dataSet}...`);
    const dataSetMeta = await client.getDataSetMeta(options.dataSet);
    const dataElementMap: Record<string, string> = {};
    if (dataSetMeta.dataSetElements) {
      for (const dse of dataSetMeta.dataSetElements) {
        if (dse.dataElement) {
          dataElementMap[dse.dataElement.id] = dse.dataElement.name;
        }
      }
    }

    const cocMap = await client.getCategoryOptionCombos();

    const valuesToRevert: DataValue[] = [];

    for (const district of districts) {
      console.log(
        `Checking edits for district: ${district.name} (${district.id})...`,
      );
      for (const period of options.periods) {
        const [dataValuesResp, audits] = await Promise.all([
          client.getDataValueSets(district.id, period, options.dataSet),
          client.getDataValueAudits(district.id, period, options.dataSet),
        ]);

        const dataValues = dataValuesResp.dataValues || [];
        const mergedRows = mergeAuditData(
          dataValues,
          audits,
          dataElementMap,
          cocMap,
          district,
        );

        for (const row of mergedRows) {
          if (row.history && row.history.length > 0) {
            const previousValue = row.history[0].value;
            console.log(
              `  [Revert candidate] DE: ${row.dataElementName} (${row.dataElementId}) | Period: ${row.period} | Current: "${row.currentValue}" -> Revert to: "${previousValue}"`,
            );

            const dv: DataValue = {
              dataElement: row.dataElementId,
              period: row.period,
              orgUnit: row.orgUnitId,
              categoryOptionCombo:
                row.categoryOptionComboId !== "default"
                  ? row.categoryOptionComboId
                  : undefined,
              attributeOptionCombo: row.attributeOptionComboId,
              value: previousValue,
              comment: `Reverted to previous value from ${row.currentValue} modified by (${row.modifiedBy})`,
            };
            valuesToRevert.push(dv);
          }
        }
      }
    }

    if (valuesToRevert.length === 0) {
      console.log("\n[Revert] No edited dataset values found to revert.");
      return {
        totalReverted: 0,
        orgUnitsProcessed: districts.length,
        status: "NO_CHANGES",
      };
    }

    console.log(
      `\nFound ${valuesToRevert.length} value(s) to revert across ${districts.length} district(s).`,
    );

    if (options.dryRun) {
      const report = generateImportReport({
        totalReverted: valuesToRevert.length,
        orgUnitsProcessed: districts.length,
        dryRun: true,
      });
      console.log("\n" + report);
      return {
        totalReverted: valuesToRevert.length,
        orgUnitsProcessed: districts.length,
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
      orgUnitsProcessed: districts.length,
      importSummary: aggregatedSummary,
      dryRun: false,
    });
    console.log("\n" + report);

    return {
      totalReverted: valuesToRevert.length,
      orgUnitsProcessed: districts.length,
      status: aggregatedSummary.status || "SUCCESS",
      importSummary: aggregatedSummary,
    };
  }
}
