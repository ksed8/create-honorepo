import { existsSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { detectEatenFlags, runPrompts, type Answers } from './prompts.js';
import { detectTool, runGitInit, runPnpmInstall } from './postinstall.js';
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

  // `.` scaffolds into the current directory, named after it.
  const inPlace = parsed.name === '.';
  let name = parsed.name;
  if (inPlace) {
    name = basename(process.cwd());
    const derived = validateName(name);
    if (!derived.ok) {
      process.stderr.write(
        pc.red(`  ✖ Current directory name "${name}" is not a valid project name.\n`) +
          pc.dim(`    (${derived.reason})\n`) +
          pc.dim(`    Pass an explicit name instead: npm create honorepo <project-name>\n`),
      );
      return 1;
    }
  }

  let initial: { projectName?: string; scope?: string; install?: boolean; git?: boolean };
  if (parsed.yes) {
    if (!name) {
      process.stderr.write(pc.red('  ✖ --yes requires a project name positional argument\n'));
      return 1;
    }
    initial = {
      projectName: name,
      scope: parsed.scope ?? name,
      install: parsed.install ?? detectTool('pnpm'),
      git: parsed.git ?? detectTool('git'),
    };
  } else {
    initial = {
      projectName: name,
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

  const targetDir = inPlace ? process.cwd() : resolve(process.cwd(), answers.projectName);
  const targetLabel = inPlace ? 'the current directory' : `./${answers.projectName}`;
  const empty = assertTargetDirEmpty(targetDir);
  if (!empty.ok) {
    process.stderr.write(pc.red(`  ✖ ${targetLabel} is not empty:\n`));
    for (const entry of empty.entries.slice(0, 10)) {
      process.stderr.write(pc.dim(`      ${entry}\n`));
    }
    if (empty.entries.length > 10) {
      process.stderr.write(pc.dim(`      …and ${empty.entries.length - 10} more\n`));
    }
    return 1;
  }

  process.stdout.write(`\n  Scaffolding into ${targetLabel} …\n`);
  const targetPreExisted = existsSync(targetDir);
  let created: string[];
  try {
    created = scaffold(getTemplateDir(), targetDir, {
      projectName: answers.projectName,
      scope: answers.scope,
    });
  } catch (err) {
    if (!targetPreExisted) {
      rmSync(targetDir, { recursive: true, force: true });
      process.stderr.write(pc.red(`  ✖ Scaffolding failed; removed partial ${targetLabel}\n`));
    } else {
      process.stderr.write(pc.red(`  ✖ Scaffolding failed; partial files left in ${targetLabel}\n`));
    }
    throw err;
  }
  process.stdout.write(pc.green(`  ✓ Created ${created.length} files\n`));

  // Install before git init so pnpm-lock.yaml lands in the initial commit —
  // the generated CI runs `pnpm install --frozen-lockfile` and needs it there.
  let installOk = true;
  if (answers.install) {
    installOk = await runPnpmInstall(targetDir);
    if (!installOk) {
      process.stdout.write(
        pc.yellow(`  ! The project was created, but dependency installation failed.\n`) +
          pc.yellow(`    Fix pnpm, then run \`pnpm install\` inside the project.\n`),
      );
    }
  }

  if (answers.git) {
    if (existsSync(join(targetDir, '.git'))) {
      // Never create commits inside a repository the user already set up.
      process.stdout.write(pc.dim('  i Existing git repository detected; skipping git init\n'));
    } else {
      runGitInit(targetDir);
    }
  }

  printNextSteps(answers, { inPlace, installed: answers.install && installOk });
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

function printNextSteps(
  answers: Answers,
  status: { inPlace: boolean; installed: boolean },
): void {
  const dbFilter = answers.scope ? `@${answers.scope}/db` : `${answers.projectName}-db`;
  process.stdout.write(`\n  ${pc.bold('Done.')} Next steps:\n\n`);
  if (!status.inPlace) process.stdout.write(`    cd ${answers.projectName}\n`);
  if (!status.installed) process.stdout.write(`    pnpm install\n`);
  process.stdout.write(`    pnpm setup:env\n`);
  process.stdout.write(`    docker compose up -d\n`);
  process.stdout.write(`    pnpm --filter ${dbFilter} migrate:dev --name init\n`);
  process.stdout.write(`    pnpm dev\n\n`);
}
