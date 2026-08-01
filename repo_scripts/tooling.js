const { spawnSync } = require("child_process");

const NIGHTLY_VERSION = "nightly-2020-03-10";
const CARGO_WEB_VERSION = "0.6.24";
const ALLOW_MUTATION = process.env.CITYBOUND_ALLOW_TOOLCHAIN_MUTATION === "1";
const quiet = process.argv.includes("-q");

function run(command, args, options = {}) {
    return spawnSync(command, args, {
        encoding: "utf8",
        stdio: options.inherit ? "inherit" : "pipe",
    });
}

function fail(message) {
    console.error(message);
    process.exit(1);
}

const rustupVersion = run("rustup", ["--version"]);
if (rustupVersion.status !== 0 || !rustupVersion.stdout.startsWith("rustup")) {
    fail("Rustup missing. Install it from https://rustup.rs and rerun this inspection.");
}
!quiet && console.log("Rustup installed ✅ (OK)");

function hostTriple() {
    if (process.platform === "win32") return "x86_64-pc-windows-msvc";
    if (process.platform === "darwin") return "x86_64-apple-darwin";
    if (process.platform === "linux") return "x86_64-unknown-linux-gnu";
    fail(`Unsupported host for Citybound compatibility tooling: ${process.platform}`);
}

const toolchain = `${NIGHTLY_VERSION}-${hostTriple()}`;
const installed = run("rustup", ["toolchain", "list"]);
if (installed.status !== 0) fail("Could not inspect installed rustup toolchains.");

const hasToolchain = installed.stdout
    .split(/\r?\n/)
    .map(line => line.trim().split(/\s+/)[0])
    .includes(toolchain);

if (!hasToolchain) {
    if (!ALLOW_MUTATION) {
        fail(
            `Required Rust toolchain ${toolchain} is not installed.\n`
            + "Inspection did not mutate the host. After reviewing the pinned toolchain, "
            + "rerun with CITYBOUND_ALLOW_TOOLCHAIN_MUTATION=1 to authorize rustup installation."
        );
    }
    console.log(`Installing explicitly authorized Rust toolchain ${toolchain}...`);
    const installArgs = ["toolchain", "install", toolchain];
    if (process.platform === "darwin") installArgs.push("--force-non-host");
    const install = run("rustup", installArgs, { inherit: true });
    if (install.status !== 0) fail(`Failed to install ${toolchain}.`);
}
!quiet && console.log(`Required Rust toolchain available: ${toolchain} ✅ (OK)`);

const cargoWeb = run("cargo-web", ["--version"]);
if (
    cargoWeb.status !== 0
    || !new RegExp(`^cargo-web ${CARGO_WEB_VERSION}(?:\\s|$)`).test(cargoWeb.stdout.trim())
) {
    fail(
        `cargo-web ${CARGO_WEB_VERSION} is required but was not found exactly.\n`
        + "The legacy unauthenticated prebuilt-binary download is disabled. This command will "
        + "not download or globally install cargo-web. Follow docs/LOCAL_DEVELOPMENT.md for "
        + "the explicit source-install route, then rerun."
    );
}
!quiet && console.log(`cargo-web ${CARGO_WEB_VERSION} available ✅ (OK)`);

if (ALLOW_MUTATION) {
    console.log("Installing explicitly authorized formatting components...");
    for (const component of ["rustfmt-preview", "clippy-preview"]) {
        const add = run(
            "rustup",
            ["component", "add", component, "--toolchain", toolchain],
            { inherit: true }
        );
        if (add.status !== 0) fail(`Failed to install ${component} for ${toolchain}.`);
    }
} else {
    !quiet && console.log(
        "Toolchain inspection completed without installing components or changing rustup overrides."
    );
}
