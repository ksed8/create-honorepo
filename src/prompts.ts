import prompts from 'prompts';
import pc from 'picocolors';
import { normalizeScope, validateName, validateScope } from './validate.js';
import { detectTool } from './postinstall.js';

export type Answers = {
  projectName: string;
  scope: string;
  install: boolean;
  git: boolean;
};

export type Defaults = {
  projectName?: string;
  scope?: string;
  install?: boolean;
  git?: boolean;
};

export async function runPrompts(initial: Defaults): Promise<Answers> {
  const hasGit = detectTool('git');
  const hasPnpm = detectTool('pnpm');

  const onCancel = (): boolean => {
    process.stdout.write(pc.yellow('\n  Cancelled.\n'));
    process.exit(1);
  };

  const responses = await prompts(
    [
      {
        type: initial.projectName ? null : 'text',
        name: 'projectName',
        message: 'Project name',
        validate: (value: string) => {
          const result = validateName(value);
          return result.ok ? true : result.reason;
        },
      },
      {
        type: initial.scope !== undefined ? null : 'text',
        name: 'scope',
        message: 'Package scope (empty = unscoped names like <project>-web)',
        initial: (_prev, values) =>
          (initial.projectName ?? (values.projectName as string)) ?? '',
        validate: (value: string) => {
          const result = validateScope(value);
          return result.ok ? true : result.reason;
        },
      },
      {
        type: initial.git !== undefined ? null : 'confirm',
        name: 'git',
        message: hasGit
          ? 'Initialize a git repository?'
          : 'Initialize a git repository? (git not on PATH; will be skipped)',
        initial: hasGit,
      },
      {
        type: initial.install !== undefined ? null : 'confirm',
        name: 'install',
        message: hasPnpm
          ? 'Install dependencies now?'
          : `${pc.yellow('!')} pnpm not found. Install anyway? (will fail; install pnpm 10+ first)`,
        initial: hasPnpm,
      },
    ],
    { onCancel },
  );

  const projectName = (initial.projectName ?? responses.projectName) as string;
  const rawScope = initial.scope ?? (responses.scope as string | undefined) ?? projectName;
  const scope = normalizeScope(rawScope);
  const install = (initial.install ?? responses.install) as boolean;
  const git = (initial.git ?? responses.git) as boolean;

  return { projectName, scope, install, git };
}

// When invoked as `npm create honorepo my-app --scope acme` (no `--`), npm consumes the
// flags itself and exposes them only as npm_config_* environment variables. Detection is
// best-effort: reconstruct any of OUR flags found there so the tip can show what to retype.
export function detectEatenFlags(
  env: Record<string, string | undefined> = process.env,
  argv: string[] = process.argv.slice(2),
): string | null {
  // npm ≤6 published the full original argv; use it when present.
  const legacy = env.npm_config_argv;
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as { original?: string[] };
      const original = parsed.original ?? [];
      const eaten = original.filter(
        (arg) =>
          arg.startsWith('--') &&
          !argv.includes(arg) &&
          !arg.startsWith('--silent') &&
          !arg.startsWith('--quiet') &&
          !arg.startsWith('--loglevel'),
      );
      if (eaten.length > 0) return eaten.join(' ');
    } catch {
      // fall through to the npm 7+ detection
    }
  }

  if (!env.npm_config_user_agent?.startsWith('npm')) return null;

  const found: string[] = [];
  const scope = env.npm_config_scope;
  if (scope === 'false' && !argv.includes('--no-scope')) {
    found.push('--no-scope');
  } else if (scope && !argv.includes('--scope')) {
    found.push(`--scope ${scope.startsWith('@') ? scope.slice(1) : scope}`);
  }
  for (const flag of ['yes', 'install', 'git'] as const) {
    const value = env[`npm_config_${flag}`];
    if (value === 'true' && !argv.includes(`--${flag}`) && !argv.includes('-y')) {
      found.push(`--${flag}`);
    } else if (value === 'false' && !argv.includes(`--no-${flag}`)) {
      found.push(`--no-${flag}`);
    }
  }
  return found.length > 0 ? found.join(' ') : null;
}
