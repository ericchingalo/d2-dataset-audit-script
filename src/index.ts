import "dotenv/config";
import { Command } from "commander";
import { Dhis2ApiClient } from "./services/dhis2-api.js";
import { mergeAuditData } from "./services/audit-merger.js";
import { generateExcelReport } from "./services/excel-exporter.js";
import { MergedAuditRow } from "./types/dhis2.js";

async function main() {
  const program = new Command();

  program
    .name("d2-dataset-audit")
    .description("DHIS2 Dataset Audit Excel Report Generator CLI")
    .version("1.0.0")
    .requiredOption(
      "-ou, --parentOrgUnit <id>",
      "Parent Organisation Unit ID (fetches level 4 districts under this parent)",
    )
    .requiredOption("-ds, --dataSet <id>", "DHIS2 Dataset ID")
    .requiredOption(
      "-pe, --periods <periods>",
      "Comma-separated list of periods (e.g. 2026 or 202601,202602)",
    )
    .option(
      "-o, --output <filename>",
      "Output Excel filename",
      "dataset_audit_report.xlsx",
    )
    .option(
      "--baseUrl <url>",
      "DHIS2 Base URL (overrides DHIS2_BASE_URL env variable)",
    );

  program.parse(process.argv);
  const options = program.opts();

  const baseUrl = options.baseUrl || process.env.DHIS2_BASE_URL;
  const username = process.env.DHIS2_USERNAME;
  const password = process.env.DHIS2_PASSWORD;
  const patToken = process.env.DHIS2_PAT_TOKEN;

  if (!baseUrl) {
    console.error(
      "Error: DHIS2 Base URL must be specified via --baseUrl option or DHIS2_BASE_URL environment variable.",
    );
    process.exit(1);
  }

  if (!patToken && (!username || !password)) {
    console.error(
      "Error: Credentials required. Set DHIS2_USERNAME & DHIS2_PASSWORD or DHIS2_PAT_TOKEN in .env",
    );
    process.exit(1);
  }

  const periodsList = options.periods
    .split(",")
    .map((p: string) => p.trim())
    .filter(Boolean);

  if (periodsList.length === 0) {
    console.error("Error: At least one period must be specified.");
    process.exit(1);
  }

  console.log("--- DHIS2 Dataset Audit Generator ---");
  console.log(`Base URL:       ${baseUrl}`);
  console.log(`Parent OrgUnit: ${options.parentOrgUnit}`);
  console.log(`DataSet ID:     ${options.dataSet}`);
  console.log(`Periods:        ${periodsList.join(", ")}`);
  console.log(`Output File:    ${options.output}\n`);

  const client = new Dhis2ApiClient({
    baseUrl,
    username,
    password,
    patToken,
  });

  // Step 1: Fetch Districts
  console.log("Fetching level 4 district organisation units...");
  const districts = await client.getDistricts(options.parentOrgUnit);
  console.log(`Found ${districts.length} district(s).\n`);

  if (districts.length === 0) {
    console.warn("No districts found matching the criteria.");
  }

  // Step 2: Fetch DataSet Metadata
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
  console.log(
    `Loaded ${Object.keys(dataElementMap).length} data element(s) from dataset form.\n`,
  );

  // Step 3: Fetch Category Option Combos
  console.log("Fetching disaggregation (Category Option Combo) names...");
  const cocMap = await client.getCategoryOptionCombos();
  console.log(
    `Loaded ${Object.keys(cocMap).length} category option combo(s).\n`,
  );

  // Step 4: Fetch audit data per district and period
  const districtDataMap = new Map<string, MergedAuditRow[]>();
  let totalAuditRows = 0;

  for (const district of districts) {
    console.log(`Processing district: ${district.name} (${district.id})...`);
    const allDistrictRows: MergedAuditRow[] = [];

    for (const period of periodsList) {
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

      allDistrictRows.push(...mergedRows);
    }

    if (allDistrictRows.length > 0) {
      // Sort district rows by data element name, then period, then disaggregation
      allDistrictRows.sort((a, b) => {
        const deComp = a.dataElementName.localeCompare(b.dataElementName);
        if (deComp !== 0) return deComp;
        const peComp = a.period.localeCompare(b.period);
        if (peComp !== 0) return peComp;
        return a.disaggregationName.localeCompare(b.disaggregationName);
      });

      districtDataMap.set(district.name, allDistrictRows);
      totalAuditRows += allDistrictRows.length;
      console.log(
        `  -> ${allDistrictRows.length} modified audit record(s) merged for ${district.name}`,
      );
    } else {
      console.log(`  -> No modified data values found for ${district.name}`);
    }
  }

  console.log(`\nGenerating Excel report at: ${options.output}...`);
  await generateExcelReport(districtDataMap, options.output);

  console.log(`\nSuccess! Excel report created successfully.`);
  console.log(`Total district sheets created: ${districtDataMap.size}`);
  console.log(`Total audited rows exported:   ${totalAuditRows}`);
}

main().catch((err) => {
  console.error("Fatal execution error:", err);
  process.exit(1);
});
