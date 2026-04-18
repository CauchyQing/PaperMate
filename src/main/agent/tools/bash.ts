import { exec } from 'child_process';
import { promisify } from 'util';
import { registerTool } from '../tool-registry';

const execPromise = promisify(exec);

function resolveNodeCommand(command: string): string {
  const trimmed = command.trim();
  if (trimmed.startsWith('node ') || trimmed.includes('"node ') || trimmed.includes("'node ")) {
    try {
      require('child_process').execSync('node --version', { stdio: 'ignore', timeout: 2000 });
      return command;
    } catch {
      const electronNode = `"${process.execPath}"`;
      if (trimmed.startsWith('node ')) {
        return trimmed.replace(/^node\s+/, `${electronNode} `);
      }
      return command.replace(/(["'])node\s+/, `$1${electronNode} `);
    }
  }
  return command;
}

function buildShellPrefix(): string {
  const extraPaths: string[] = [];
  if (process.platform === 'darwin') {
    extraPaths.push('/usr/local/bin', '/opt/homebrew/bin', '/opt/homebrew/sbin');
  }
  extraPaths.push('/usr/bin', '/bin', '/usr/sbin', '/sbin');
  return `export PATH="${extraPaths.join(':')}:$PATH"; `;
}

registerTool(
  {
    name: 'bash',
    description: 'Execute a shell command and return stdout/stderr. In packaged Electron apps, "node" commands automatically fallback to the bundled Electron runtime.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
      },
      required: ['command'],
    },
  },
  async (args) => {
    const originalCommand = String(args.command);
    const timeout = Number(args.timeout || 30000);

    // Resolve node command fallbacks for packaged apps
    let command = resolveNodeCommand(originalCommand);

    // Prefix PATH so common tools are discoverable
    const finalCommand = buildShellPrefix() + command;

    try {
      const useElectronNode = command !== originalCommand;
      const execOptions: any = { timeout };
      if (useElectronNode) {
        execOptions.env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
      }
      const { stdout, stderr } = await execPromise(finalCommand, execOptions);
      return String(stdout || stderr || '').slice(0, 20000);
    } catch (err: any) {
      return `Error: ${err.message || String(err)}\n${err.stdout || ''}\n${err.stderr || ''}`;
    }
  }
);
