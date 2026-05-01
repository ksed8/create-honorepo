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
        message: 'Package scope',
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
          : `${pc.yellow('!')} pnpm not found. Install anyway? (will fail; install pnpm 9+ first)`,
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

export function detectEatenFlags(): string | null {
  const raw = process.env.npm_config_argv;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { original?: string[] };
    const original = parsed.original ?? [];
    const ourArgs = process.argv.slice(2);
    const flagsInOriginalNotInOurs = original.filter(
      (arg) =>
        arg.startsWith('--') &&
        !ourArgs.includes(arg) &&
        !arg.startsWith('--silent') &&
        !arg.startsWith('--quiet') &&
        !arg.startsWith('--loglevel'),
    );
    if (flagsInOriginalNotInOurs.length === 0) return null;
    return flagsInOriginalNotInOurs.join(' ');
  } catch {
    return null;
  }
}
