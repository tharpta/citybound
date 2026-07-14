const util = require('util');
const { execSync, spawnSync } = require('child_process');

const NIGHTLY_VERSION = "nightly-2020-03-10";
const NIGHTLY_VERSION_BROWSER = "nightly-2020-03-10";
const CARGO_WEB_VERSION = "0.6.24";
let quiet = process.argv[2] == "-q";

let rustupV;
try {
    rustupV = execSync('rustup --version', { encoding: 'utf8' });
} catch (e) {
    rustupV = undefined
}

if (rustupV && rustupV.startsWith("rustup")) {
    !quiet && console.log("Rustup installed ✅ (OK)");
} else {
    console.log("Rustup missing! 🛑 (FAIL)");
    console.log("Please install from https://rustup.rs");
    process.exit(1);
}

function fullNightlyVersion(nightly) {
    const nightlySuffix = process.platform === "win32"
        ? "-x86_64-pc-windows-msvc"
        : (process.platform === "darwin"
            ? "-x86_64-apple-darwin"
            : "-x86_64-unknown-linux-gnu");
    return nightly + nightlySuffix;
}

function activeToolchain() {
    return execSync('rustup show active-toolchain', { encoding: 'utf8' }).trim().split(/\s+/)[0];
}

function ensureRustNightly(nightly) {
    let rustupShow = execSync('rustup show', { encoding: 'utf8' });
    const fullVersion = fullNightlyVersion(nightly);
    const activeToolchainName = activeToolchain();

    if (activeToolchainName && activeToolchainName.includes(nightly)) {
        !quiet && console.log("Correct rust nightly set up ✅ (OK)");
        return fullVersion;
    } else {
        console.log("Wrong version of rust set up ❗️(!)");
        console.log(rustupShow.split(/\n/g).map(s => " | " + s).join("\n"));
        console.log("🔧 Overriding with correct nightly (only for this directory)...");
        console.log("> rustup override set " + fullVersion);
        spawnSync("rustup", ["override", "set", fullVersion], { stdio: 'inherit' });
        quiet = false;

        let rustupShow2 = execSync('rustup show', { encoding: 'utf8' });
        const activeToolchainName2 = activeToolchain();

        if (activeToolchainName2 && activeToolchainName2.includes(nightly)) {
            !quiet && console.log("Correct rust nightly set up ✅ (OK)");
            return fullVersion;
        } else {
            console.log("Failed to install correct toolchain 🛑 (FAIL)");
            console.log("rustup show output:");
            console.log(rustupShow2);
            process.exit(1);
        }
    }
}

!quiet && console.log("Checking rust nightly for simulation");
const simulationToolchain = ensureRustNightly(NIGHTLY_VERSION);

process.chdir('./cb_browser_ui');

!quiet && console.log("Checking rust nightly for browser");
ensureRustNightly(NIGHTLY_VERSION_BROWSER);

!quiet && console.log("Checking cargo-web version");

function checkCargoWeb(requiredVersion) {
    try {
        let cargoWebVersion = execSync('cargo-web --version', { encoding: 'utf8' });
        if (cargoWebVersion.includes(requiredVersion)) {
            return true;
        }
        return false;
    } catch (e) {
        console.log("Couldn't run cargo-web", e.message);
        return false;
    }
}

if (checkCargoWeb(CARGO_WEB_VERSION)) {
    !quiet && console.log("Correct cargo-web set up ✅ (OK)");
} else {
    !quiet && console.log("Correct cargo-web not installed yet ❗️(!)");
    console.log("🔧 Installing cargo-web");

    let platform = require("os").platform();

    if (platform == "linux" || platform == "darwin") {
        let url = "https://github.com/koute/cargo-web/releases/download/" + CARGO_WEB_VERSION + "/cargo-web-x86_64-" + (platform == "linux" ? "unknown-linux-gnu.gz" : "apple-darwin.gz");
        console.log("Downloading cargo-web executable from " + url);
        console.log(execSync('curl -L ' + url + ' | gzip -d > cargo-web', { encoding: 'utf8' }));
        console.log("Installing cargo-web executable");
        console.log(execSync('chmod +x cargo-web', { encoding: 'utf8' }));
        console.log(execSync('mkdir -p ~/.cargo/bin', { encoding: 'utf8' }));
        console.log(execSync('mv cargo-web ~/.cargo/bin', { encoding: 'utf8' }));
    } else {
        spawnSync("cargo", ["install", "cargo-web", "--force", "--vers", CARGO_WEB_VERSION],
            { stdio: quiet ? 'ignore' : 'inherit' }
        );
    }

    if (checkCargoWeb(CARGO_WEB_VERSION)) {
        !quiet && console.log("Correct cargo-web set up ✅ (OK)");
    } else {
        console.log("Failed to install cargo-web 🛑 (FAIL)");
        process.exit(1);
    }
}

process.chdir('..');

!quiet && console.log("🔧 Ensuring linting tools are installed...");
spawnSync("rustup", ["component", "add", "rustfmt-preview", "--toolchain", simulationToolchain],
    { stdio: quiet ? 'ignore' : 'inherit' }
);
spawnSync("rustup", ["component", "add", "clippy-preview", "--toolchain", simulationToolchain],
    { stdio: quiet ? 'ignore' : 'inherit' }
);
!quiet && console.log("Linting tools set up ✅ (OK)");
