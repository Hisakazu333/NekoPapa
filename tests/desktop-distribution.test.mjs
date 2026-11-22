import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { releaseSettings } from '../scripts/build-distribution.mjs';

const common = {
  npm_execpath: 'npm-cli.js',
  NEKOPAPA_ACCOUNT_API_URL: 'https://api.example.test',
  NEKOPAPA_BUILD_NUMBER: '17',
  NEKOPAPA_RELEASE_CHANNEL: 'stable',
};

test('distribution rejects local or embedded account credentials and dev builds', () => {
  for (const url of ['http://127.0.0.1:8080', 'https://user:secret@api.example.test', 'https://api.example.test?token=x']) {
    assert.throws(() => releaseSettings({ ...common, NEKOPAPA_ACCOUNT_API_URL: url }, 'darwin', 'arm64'),
      /NEKOPAPA_ACCOUNT_API_URL/);
  }
  assert.throws(() => releaseSettings({ ...common, NEKOPAPA_RELEASE_CHANNEL: 'dev' }, 'win32', 'x64'),
    /NEKOPAPA_RELEASE_CHANNEL/);
  assert.throws(() => releaseSettings(common, 'linux', 'x64'), /native macOS or Windows/);
});

test('macOS distribution requires a Developer ID Application identity and the notary key', () => {
  for (const identity of ['-', 'Apple Development: Neko (TEAMID1234)']) {
    assert.throws(() => releaseSettings({ ...common, APPLE_SIGNING_IDENTITY: identity }, 'darwin', 'arm64'),
      /Developer ID Application/);
  }
  const path = mkdtempSync(join(tmpdir(), 'nekopapa-signing-test-'));
  try {
    const key = join(path, 'key.p8');
    const config = {
      ...common,
      APPLE_SIGNING_IDENTITY: 'Developer ID Application: Neko (TEAMID1234)',
      APPLE_API_KEY_PATH: key,
      APPLE_API_KEY: 'fixture',
      APPLE_API_ISSUER: 'fixture',
    };
    assert.throws(() => releaseSettings(config, 'darwin', 'arm64'), /notarization key file/);
    writeFileSync(key, 'fixture');
    const settings = releaseSettings(config, 'darwin', 'arm64');
    assert.equal(settings.target, 'aarch64-apple-darwin');
    assert.equal(settings.teamId, 'TEAMID1234');
    assert.throws(() => releaseSettings({ ...config, APPLE_API_ISSUER: '' }, 'darwin', 'arm64'),
      /APPLE_API_ISSUER/);
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test('Windows distribution requires a pinned certificate and secure RFC 3161 endpoint', () => {
  const configured = {
    ...common,
    NEKOPAPA_WINDOWS_CERT_THUMBPRINT: '01'.repeat(20),
    NEKOPAPA_WINDOWS_TIMESTAMP_URL: 'https://timestamp.example.test',
  };
  const settings = releaseSettings(configured, 'win32', 'x64');
  assert.equal(settings.target, 'x86_64-pc-windows-msvc');
  assert.equal(settings.signTool, 'signtool.exe');
  assert.throws(() => releaseSettings({ ...configured, NEKOPAPA_WINDOWS_CERT_THUMBPRINT: 'unset' }, 'win32', 'x64'),
    /NEKOPAPA_WINDOWS_CERT_THUMBPRINT/);
  assert.throws(() => releaseSettings({ ...configured, NEKOPAPA_WINDOWS_TIMESTAMP_URL: 'http://timestamp.example.test' }, 'win32', 'x64'),
    /NEKOPAPA_WINDOWS_TIMESTAMP_URL/);
});
