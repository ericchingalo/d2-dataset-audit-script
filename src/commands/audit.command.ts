import { Command } from "commander";
import { ICLICommand } from "./command.interface.js";
import { IAuditService } from "../interfaces/audit-service.interface.js";
import { AuditService } from "../services/audit.service.js";

export class AuditCommand implements ICLICommand {
  private auditService: IAuditService;

  constructor(auditService?: IAuditService) {
    this.auditService = auditService || new AuditService();
  }

  register(program: Command): void {
    program
      .command("audit", { isDefault: true })
      .description("Generate DHIS2 dataset audit report")
      .requiredOption(
        "-p, --parentOrgUnit <id>",
        "Parent Organisation Unit ID (fetches level 4 districts under this parent)",
      )
      .requiredOption("-d, --dataSet <id>", "DHIS2 Dataset ID")
      .requiredOption(
        "-e, --periods <periods>",
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
      )
      .action(async (options) => {
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

        await this.auditService.execute({
          parentOrgUnit: options.parentOrgUnit,
          dataSet: options.dataSet,
          periods: periodsList,
          output: options.output,
          baseUrl,
          username,
          password,
          patToken,
        });
      });
  }
}
