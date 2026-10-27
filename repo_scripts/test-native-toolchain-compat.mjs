import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scripts = dirname(fileURLToPath(import.meta.url));
const triples = { darwin: 'x86_64-apple-darwin', linux: 'x86_64-unknown-linux-gnu' };
const pinned = `nightly-2020-03-10-${triples[process.platform]}`;

function fixture(t) {
    assert.ok(triples[process.platform], 'regression supports the Darwin and Linux compatibility hosts');
    const root = mkdtempSync(join(tmpdir(), 'citybound-native-toolchain-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (const directory of ['repo_scripts', 'bin', 'rustup', 'cb_browser_ui/dist']) {
        mkdirSync(join(root, directory), { recursive: true });
    }
    for (const file of ['build-server-debug-compat.sh', 'check-browser-dist-compat.sh', 'ensure-rust-toolchain-compat.sh', 'tooling.js']) {
        copyFileSync(join(scripts, file), join(root, 'repo_scripts', file));
    }
    for (const file of ['index.html', 'cb_browser_ui.wasm', 'bundle.js', 'bundle.css']) {
        writeFileSync(join(root, 'cb_browser_ui/dist', file), 'fixture');
    }
    const settings = 'default_toolchain = "stable"\n';
    writeFileSync(join(root, 'rustup/settings.toml'), settings);
    const log = join(root, 'commands.log');
    writeFileSync(log, '');
    function executable(name, body) {
        writeFileSync(join(root, 'bin', name), `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`, { mode: 0o755 });
    }
    executable('git', '[[ "$*" == "describe" ]]\nprintf "test-version\\n"');
    executable('npm', '[[ "$*" == "run ensure-tooling -- -q" ]]\nexec "$CITYBOUND_TEST_NODE" "$CITYBOUND_TEST_ROOT/repo_scripts/tooling.js" -q');
    executable('cargo-web', '[[ "$*" == "--version" ]]\nprintf "cargo-web 0.6.24\\n"');
    executable('rustup', `printf 'rustup %s\\n' "$*" >>"$CITYBOUND_TEST_LOG"
case "$*" in
    --version) printf 'rustup 1.28.0\\n' ;;
    'toolchain list')
        printf 'stable (default)\\n'
        if [[ "\${CITYBOUND_TEST_MISSING_NIGHTLY:-0}" != '1' ]]; then
            printf '%s\\n' "$CITYBOUND_TEST_PINNED"
        fi
        ;;
    *) echo 'Forbidden rustup mutation or unexpected inspection' >&2; exit 91 ;;
esac`);
    executable('cargo', `[[ "$*" == 'build' ]]
printf 'cargo build RUSTUP_TOOLCHAIN=%s\\n' "\${RUSTUP_TOOLCHAIN:-host-default-stable}" >>"$CITYBOUND_TEST_LOG"
exit "\${CITYBOUND_TEST_CARGO_EXIT:-0}"`);
    const env = { ...process.env,
        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        RUSTUP_HOME: join(root, 'rustup'),
        CITYBOUND_TEST_ROOT: root,
        CITYBOUND_TEST_LOG: log,
        CITYBOUND_TEST_PINNED: pinned,
        CITYBOUND_TEST_NODE: process.execPath,
    };
    delete env.RUSTUP_TOOLCHAIN;
    delete env.CITYBOUND_RUST_NIGHTLY;
    delete env.CITYBOUND_ALLOW_TOOLCHAIN_MUTATION;
    return {
        run: overrides => spawnSync('bash', [join(root, 'repo_scripts/build-server-debug-compat.sh')], {
            env: { ...env, ...overrides }, encoding: 'utf8', timeout: 10000,
        }),
        commands: () => readFileSync(log, 'utf8'),
        assertHostUnchanged() {
            assert.equal(readFileSync(join(root, 'rustup/settings.toml'), 'utf8'), settings);
            assert.deepEqual(readdirSync(join(root, 'rustup')), ['settings.toml']);
            assert.doesNotMatch(readFileSync(log, 'utf8'), /override|toolchain install|component add|rustup default/);
        },
    };
}

test('native child selects inspected pinned nightly without a directory override or host mutation', t => {
    const f = fixture(t);
    const parentSelection = process.env.RUSTUP_TOOLCHAIN;
    const result = f.run({});
    assert.equal(result.status, 0, result.stderr);
    assert.match(f.commands(), new RegExp(`cargo build RUSTUP_TOOLCHAIN=${pinned}`));
    assert.equal(process.env.RUSTUP_TOOLCHAIN, parentSelection);
    f.assertHostUnchanged();
});

test('native child replaces an inherited stable selection without changing its parent', t => {
    const f = fixture(t);
    const result = f.run({ RUSTUP_TOOLCHAIN: 'stable' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(f.commands(), new RegExp(`cargo build RUSTUP_TOOLCHAIN=${pinned}`));
    f.assertHostUnchanged();
});

test('missing pinned nightly fails closed before Cargo without installing it', t => {
    const f = fixture(t);
    const result = f.run({ CITYBOUND_TEST_MISSING_NIGHTLY: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not installed/);
    assert.doesNotMatch(f.commands(), /cargo build/);
    f.assertHostUnchanged();
});

test('toolchain selector failure after tooling inspection does not fall through to Cargo', t => {
    const f = fixture(t);
    const result = f.run({ CITYBOUND_RUST_NIGHTLY: 'nightly-missing' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not installed/);
    assert.doesNotMatch(f.commands(), /cargo build/);
    f.assertHostUnchanged();
});

test('native Cargo failure propagates with the pinned selection and no host mutation', t => {
    const f = fixture(t);
    const result = f.run({ CITYBOUND_TEST_CARGO_EXIT: '43' });
    assert.equal(result.status, 43, result.stderr);
    assert.match(f.commands(), new RegExp(`cargo build RUSTUP_TOOLCHAIN=${pinned}`));
    f.assertHostUnchanged();
});
