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
    const districts = await client.getDistricts(options.parentOrgUnit);
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

    console.log("Posting reverted values to DHIS2 (api/dataValueSets)...");
    let importSummary: DataValueImportSummary;
    try {
      importSummary = await client.postDataValueSets({
        dataSet: options.dataSet,
        dataValues: valuesToRevert,
      });

      const report = generateImportReport({
        totalReverted: valuesToRevert.length,
        orgUnitsProcessed: districts.length,
        importSummary,
        dryRun: false,
      });
      console.log("\n" + report);
    } catch (error) {
      console.error(
        `[Error] Failed to post reverted values to DHIS2: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        totalReverted: valuesToRevert.length,
        orgUnitsProcessed: districts.length,
        status: "ERROR",
      };
    }

    return {
      totalReverted: valuesToRevert.length,
      orgUnitsProcessed: districts.length,
      status: importSummary.status || "SUCCESS",
      importSummary,
    };
  }
}
