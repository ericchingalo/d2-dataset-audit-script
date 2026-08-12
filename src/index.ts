import "dotenv/config";
import { Command } from "commander";
import { normalizeArgs } from "./utils/args-normalizer.js";
import { AuditCommand } from "./commands/audit.command.js";
import { RevertCommand } from "./commands/revert.command.js";

export { normalizeArgs };

export async function main() {
  const program = new Command();

  program
    .name("d2-dataset-audit")
    .description("DHIS2 Dataset Audit Excel Report & Revert Generator CLI")
    .version("1.0.0");

  const auditCommand = new AuditCommand();
  const revertCommand = new RevertCommand();

  auditCommand.register(program);
  revertCommand.register(program);

  program.parse(normalizeArgs(process.argv));
}

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  main().catch((err) => {
    console.error("Fatal execution error:", err);
    process.exit(1);
  });
}
