import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const bundler = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const targetArch = { arm64: 'aarch64', x64: 'x86_64' };

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Set ${name} on the release runner`);
  return value;
}

function configuredHttps(environment, name) {
  let url;
  try {
    url = new URL(required(environment, name));
  } catch {
    throw new Error(`Set ${name} to a valid HTTPS URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error(`Set ${name} to an HTTPS URL without credentials or a fragment`);
  }
  return url;
}

export function releaseSettings(environment, platform, arch) {
  if (!['darwin', 'win32'].includes(platform) || !Object.hasOwn(targetArch, arch)) {
    throw new Error('Distribution builds require a native macOS or Windows arm64/x64 runner');
  }
  const accountApi = configuredHttps(environment, 'NEKOPAPA_ACCOUNT_API_URL');
  if (accountApi.search) throw new Error('NEKOPAPA_ACCOUNT_API_URL must not contain a query');
  const buildNumber = required(environment, 'NEKOPAPA_BUILD_NUMBER');
  if (!/^[1-9]\d*$/.test(buildNumber) || !Number.isSafeInteger(Number(buildNumber))) {
    throw new Error('NEKOPAPA_BUILD_NUMBER must be a positive safe integer');
  }
  const channel = required(environment, 'NEKOPAPA_RELEASE_CHANNEL');
  if (!['stable', 'beta'].includes(channel)) {
    throw new Error('NEKOPAPA_RELEASE_CHANNEL must be stable or beta');
  }
  const base = { buildNumber, channel, npm: required(environment, 'npm_execpath') };

  if (platform === 'darwin') {
    const identity = required(environment, 'APPLE_SIGNING_IDENTITY');
    const match = /^Developer ID Application: .+ \(([A-Z0-9]{10})\)$/.exec(identity);
    if (!match) throw new Error('APPLE_SIGNING_IDENTITY must identify a Developer ID Application certificate');
    const keyPath = required(environment, 'APPLE_API_KEY_PATH');
    if (!existsSync(keyPath) || !statSync(keyPath).isFile()) {
      throw new Error('APPLE_API_KEY_PATH must reference the notarization key file');
    }
    required(environment, 'APPLE_API_KEY');
    required(environment, 'APPLE_API_ISSUER');
    return { ...base, target: `${targetArch[arch]}-apple-darwin`, teamId: match[1] };
  }

  const thumbprint = required(environment, 'NEKOPAPA_WINDOWS_CERT_THUMBPRINT');
  if (!/^[a-f\d]{40}$/i.test(thumbprint)) {
    throw new Error('NEKOPAPA_WINDOWS_CERT_THUMBPRINT must contain 40 hexadecimal characters');
  }
  const timestamp = configuredHttps(environment, 'NEKOPAPA_WINDOWS_TIMESTAMP_URL');
  const signTool = environment.NEKOPAPA_SIGNTOOL?.trim() || 'signtool.exe';
  return { ...base, target: `${targetArch[arch]}-pc-windows-msvc`, thumbprint, timestamp, signTool };
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${basename(command)} failed (${result.status ?? result.signal ?? 'unknown status'})`);
  }
}

function buildApp(settings, environment, cargoTarget) {
  const args = ['run', 'tauri', '--', 'build', '--ci', '--target', settings.target];
  if (settings.teamId) {
    args.push('--bundles', 'app', '--config', JSON.stringify({ bundle: { macOS: { hardenedRuntime: true } } }));
  } else {
    const signCommand = {
      cmd: process.execPath,
      args: [script, '--sign-windows', '%1'],
    };
    args.push('--bundles', 'nsis', '--config', JSON.stringify({ bundle: { windows: { signCommand } } }));
  }

  run(process.execPath, [settings.npm, ...args], {
    ...environment,
    CARGO_TARGET_DIR: cargoTarget,
    CARGO_PROFILE_RELEASE_DEBUG: '1',
    CARGO_PROFILE_RELEASE_SPLIT_DEBUGINFO: 'packed',
    CARGO_PROFILE_RELEASE_STRIP: 'debuginfo',
  });
}

function verifiedMacArchive(settings, release, staging, label) {
  const bundle = join(release, 'bundle', 'macos', `${bundler.productName}.app`);
  const requirement = `anchor apple generic and identifier "${bundler.identifier}" and certificate leaf[subject.OU] = "${settings.teamId}" and certificate leaf[field.1.2.840.113635.100.6.1.13] exists`;
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle]);
  run('/usr/bin/codesign', ['--verify', '-R', requirement, bundle]);
  run('/usr/bin/xcrun', ['stapler', 'validate', bundle]);
  run('/usr/sbin/spctl', ['--assess', '--type', 'execute', bundle]);
  const archive = join(staging, `${label}.zip`);
  run('/usr/bin/ditto', ['-c', '-k', '--keepParent', bundle, archive]);
  return archive;
}

function verifiedWindowsInstaller(settings, release) {
  const installers = join(release, 'bundle', 'nsis');
  const candidates = readdirSync(installers).filter((name) => name.endsWith('-setup.exe'));
  if (candidates.length !== 1) throw new Error('Expected exactly one NSIS installer for this build');
  const installer = join(installers, candidates[0]);
  run(settings.signTool, ['verify', '/pa', '/tw', installer]);
  return installer;
}

function signWindows(path) {
  if (process.platform !== 'win32' || !path) throw new Error('Windows bundler signing requires a file');
  const settings = releaseSettings(process.env, process.platform, process.arch);
  run(settings.signTool, [
    'sign', '/s', 'My', '/sha1', settings.thumbprint,
    '/fd', 'SHA256', '/tr', settings.timestamp.href, '/td', 'SHA256', path,
  ]);
  // Tauri restores the unsigned main binary after embedding it in the installer.
  // Verify each signed binary before bundling replaces the temporary source file.
  run(settings.signTool, ['verify', '/pa', '/tw', path]);
}

function distribute() {
  const settings = releaseSettings(process.env, process.platform, process.arch);
  const staging = mkdtempSync(join(tmpdir(), 'nekopapa-distribution-'));
  try {
    const target = join(staging, 'target');
    buildApp(settings, process.env, target);
    const release = join(target, settings.target, 'release');
    const label = `NekoPapa-${bundler.version}-${settings.buildNumber}-${settings.channel}-${settings.target}`;
    const artifact = settings.teamId
      ? verifiedMacArchive(settings, release, staging, label)
      : verifiedWindowsInstaller(settings, release);
    const symbols = settings.teamId ? 'nekopapa.dSYM' : 'nekopapa.pdb';
    const symbolSource = join(release, symbols);
    if (!existsSync(symbolSource)) throw new Error(`Missing private debug symbols: ${symbols}`);

    const suffix = basename(staging).split('-').at(-1);
    const symbolOutput = join(root, '.local', 'distribution-symbols', `${label}-${suffix}`);
    mkdirSync(symbolOutput, { recursive: true, mode: 0o700 });
    cpSync(symbolSource, join(symbolOutput, symbols), { recursive: true, errorOnExist: true, force: false });
    const output = join(root, '.local', 'distribution', `${label}-${suffix}`);
    mkdirSync(output, { recursive: true, mode: 0o700 });
    const file = join(output, settings.teamId ? `${label}.zip` : `${label}-setup.exe`);
    cpSync(artifact, file, { force: false, errorOnExist: true });
    console.log(`Verified distribution: ${file}`);
    console.log(`Private debug symbols: ${symbolOutput}`);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === script) {
  try {
    if (process.argv[2] === '--sign-windows') {
      signWindows(process.argv[3]);
    } else {
      distribute();
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
