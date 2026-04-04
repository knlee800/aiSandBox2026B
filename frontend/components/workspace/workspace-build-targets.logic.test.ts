import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  detectBuildToolchainUnavailable,
  resolveWorkspaceBuildCommand,
  WORKSPACE_BUILD_TARGET_OPTIONS,
} from './workspace-build-targets.logic';

describe('workspace build targets logic', () => {
  test('resolves explicit build targets to bounded commands', () => {
    const ios = resolveWorkspaceBuildCommand('ios');
    const mac = resolveWorkspaceBuildCommand('mac');
    const mobile = resolveWorkspaceBuildCommand('mobile');
    assert.equal(ios.target, 'ios');
    assert.equal(mac.target, 'mac');
    assert.equal(mobile.target, 'mobile');
    assert.match(ios.command, /xcodebuild/);
    assert.match(mac.command, /xcodebuild/);
    assert.match(mobile.command, /npm/);
  });

  test('falls back to first bounded target for unknown input', () => {
    const fallback = resolveWorkspaceBuildCommand('unknown-target');
    assert.equal(fallback.target, WORKSPACE_BUILD_TARGET_OPTIONS[0].value);
    assert.equal(fallback.command, WORKSPACE_BUILD_TARGET_OPTIONS[0].command);
  });

  test('detects unavailable toolchain failures with bounded messaging', () => {
    assert.equal(
      detectBuildToolchainUnavailable({
        exitCode: 127,
        stdout: 'xcodebuild toolchain unavailable on this session runtime.',
        stderr: '',
      }),
      true,
    );
    assert.equal(
      detectBuildToolchainUnavailable({
        exitCode: 1,
        stdout: '',
        stderr: '/bin/sh: xcodebuild: not found',
      }),
      true,
    );
    assert.equal(
      detectBuildToolchainUnavailable({
        exitCode: 1,
        stdout: '',
        stderr: 'build failed',
      }),
      false,
    );
  });
});
