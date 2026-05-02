import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { detectEatenFlags, runPrompts } from './prompts.js';
import { runGitInit, runPnpmInstall } from './postinstall.js';
import { scaffold } from './scaffold.js';
import { assertTargetDirEmpty, validateName, validateScope } from './validate.js';

export type ParsedArgs = {
  name?: string;
  scope?: string;
  install?: boolean;
  git?: boolean;
  yes: boolean;
};

export async function run(parsed: ParsedArgs): Promise<number> {
  printBanner();

  const eaten = detectEatenFlags();
  if (eaten) {
    process.stdout.write(
      pc.yellow(
        `  i Tip: with \`npm create\`, pass flags after \`--\`:\n` +
          `        npm create honorepo my-app -- ${eaten}\n\n`,
      ),
    );
  }

  let initial: { projectName?: string; scope?: string; install?: boolean; git?: boolean };
  if (parsed.yes) {
    if (!parsed.name) {
      process.stderr.write(pc.red('  ✖ --yes requires a project name positional argument\n'));
      return 1;
    }
    initial = {
      projectName: parsed.name,
      scope: parsed.scope ?? parsed.name,
      install: parsed.install ?? true,
      git: parsed.git ?? true,
    };
  } else {
    initial = {
      projectName: parsed.name,
      scope: parsed.scope,
      install: parsed.install,
      git: parsed.git,
    };
  }

  const answers = await runPrompts(initial);

  const nameValid = validateName(answers.projectName);
  if (!nameValid.ok) {
    process.stderr.write(pc.red(`  ✖ ${nameValid.reason}\n`));
    return 1;
  }
  const scopeValid = validateScope(answers.scope);
  if (!scopeValid.ok) {
    process.stderr.write(pc.red(`  ✖ ${scopeValid.reason}\n`));
    return 1;
  }

  const targetDir = resolve(process.cwd(), answers.projectName);
  const empty = assertTargetDirEmpty(targetDir);
  if (!empty.ok) {
    process.stderr.write(pc.red(`  ✖ ./${answers.projectName} is not empty:\n`));
    for (const entry of empty.entries.slice(0, 10)) {
      process.stderr.write(pc.dim(`      ${entry}\n`));
    }
    if (empty.entries.length > 10) {
      process.stderr.write(pc.dim(`      …and ${empty.entries.length - 10} more\n`));
    }
    return 1;
  }

  process.stdout.write(`\n  Scaffolding into ./${answers.projectName} …\n`);
  const created = scaffold(getTemplateDir(), targetDir, {
    projectName: answers.projectName,
    scope: answers.scope,
  });
  process.stdout.write(pc.green(`  ✓ Created ${created.length} files\n`));

  if (answers.git) runGitInit(targetDir);

  if (answers.install) {
    const ok = await runPnpmInstall(targetDir);
    if (!ok) return 1;
  }

  printNextSteps(answers.projectName);
  return 0;
}

function getTemplateDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = join(here, '..', 'template');
  if (existsSync(candidate)) return candidate;
  throw new Error(`Template directory not found at ${candidate}`);
}

function printBanner(): void {
  process.stdout.write(`\n  ${pc.bold('create-honorepo')}\n\n`);
}

function printNextSteps(name: string): void {
  process.stdout.write(`\n  ${pc.bold('Done.')} Next steps:\n\n`);
  process.stdout.write(`    cd ${name}\n`);
  process.stdout.write(`    pnpm setup:env\n`);
  process.stdout.write(`    pnpm dev\n\n`);
}
