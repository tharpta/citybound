#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import { installSignalCleanup } from "./signal-cleanup.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
async function allocateLoopbackPort() {
    const listener = createServer();
    await new Promise((resolveListen, rejectListen) => {
        listener.once("error", rejectListen);
        listener.listen(0, "127.0.0.1", resolveListen);
    });
    const { port } = listener.address();
    await new Promise(resolveClose => listener.close(resolveClose));
    return port;
}

const bind =
    process.env.CITYBOUND_BROWSER_SMOKE_BIND
    ?? `127.0.0.1:${await allocateLoopbackPort()}`;
let bindSimulation =
    process.env.CITYBOUND_BROWSER_SMOKE_BIND_SIM
    ?? `127.0.0.1:${await allocateLoopbackPort()}`;
while (bindSimulation === bind) {
    bindSimulation = `127.0.0.1:${await allocateLoopbackPort()}`;
}
const url = `http://${bind}/`;
const expectedSimulationPort = Number(bindSimulation.slice(bindSimulation.lastIndexOf(":") + 1));
const serverPath = join(repoRoot, "target", "debug", "citybound");
const browserTimeoutMs = Number(process.env.CITYBOUND_BROWSER_SMOKE_TIMEOUT_MS ?? 30_000);
const explicitCityDir = process.env.CITYBOUND_BROWSER_SMOKE_CITY_DIR;

let browser;
let server;
let temporaryCityDir;
let serverLog = "";
let cleanupPromise;

function rememberServerOutput(chunk) {
    serverLog = `${serverLog}${chunk}`;
    if (serverLog.length > 100_000) {
        serverLog = serverLog.slice(-100_000);
    }
}

async function waitForServer() {
    const deadline = Date.now() + 20_000;

    while (Date.now() < deadline) {
        if (server.exitCode !== null) {
            throw new Error(`Citybound exited before browser startup.\n${serverLog}`);
        }

        try {
            const response = await fetch(url);
            const page = await response.text();
            if (
                response.status === 200
                && page.includes(`simulationPort: ${expectedSimulationPort}`)
            ) {
                return;
            }
        } catch {
            // The HTTP listener may not be ready yet.
        }

        await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
    }

    throw new Error(`Timed out waiting for ${url}.\n${serverLog}`);
}

async function launchBrowser() {
    const executablePath = process.env.CITYBOUND_BROWSER_EXECUTABLE;
    if (executablePath) {
        return chromium.launch({ executablePath, headless: true });
    }

    const bundledExecutable = chromium.executablePath();
    try {
        await access(bundledExecutable);
        return chromium.launch({ executablePath: bundledExecutable, headless: true });
    } catch {
        return chromium.launch({
            channel: process.env.CITYBOUND_BROWSER_CHANNEL ?? "chrome",
            headless: true,
        });
    }
}

async function stopServer() {
    const exited = () => server.exitCode !== null || server.signalCode !== null;
    if (!server || exited()) {
        return true;
    }

    server.kill("SIGINT");
    await Promise.race([
        once(server, "exit"),
        new Promise(resolveDelay => setTimeout(resolveDelay, 5_000)),
    ]);

    if (!exited()) {
        server.kill("SIGTERM");
        await Promise.race([
            once(server, "exit"),
            new Promise(resolveDelay => setTimeout(resolveDelay, 2_000)),
        ]);
    }
    if (!exited()) {
        server.kill("SIGKILL");
        await Promise.race([
            once(server, "exit"),
            new Promise(resolveDelay => setTimeout(resolveDelay, 2_000)),
        ]);
    }
    if (!exited()) {
        console.error(
            `Citybound PID ${server.pid} remains after bounded SIGINT/SIGTERM/SIGKILL teardown.`,
        );
        console.error("Do not start another runtime probe; recover the host OS state first.");
        return false;
    }
    return true;
}

async function cleanupOnce() {
    await browser?.close();
    const stopped = await stopServer();

    if (temporaryCityDir && stopped) {
        await rm(temporaryCityDir, { recursive: true, force: true });
    } else if (temporaryCityDir) {
        console.error(`Disposable city preserved at ${temporaryCityDir}.`);
        process.exitCode = 1;
    }
    return stopped;
}

function cleanup() {
    cleanupPromise ??= cleanupOnce();
    return cleanupPromise;
}

const removeSignalCleanup = installSignalCleanup(cleanup);

try {
    await access(serverPath);
    await access(join(repoRoot, "cb_browser_ui", "dist", "index.html"));

    const cityDir =
        explicitCityDir
        ?? (temporaryCityDir = await mkdtemp(join(tmpdir(), "citybound-browser-smoke-")));

    server = spawn(
        serverPath,
        [
            "--mode",
            "local",
            "--bind",
            bind,
            "--bind-sim",
            bindSimulation,
            cityDir,
        ],
        {
            cwd: repoRoot,
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    server.stdout.on("data", rememberServerOutput);
    server.stderr.on("data", rememberServerOutput);

    await waitForServer();

    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const browserErrors = [];
    let masterPlanUpdates = 0;

    page.on("console", message => {
        if (message.type() === "error") {
            browserErrors.push(`console: ${message.text()}`);
        }
        if (message.text().includes("Got master plan update")) {
            masterPlanUpdates += 1;
        }
    });
    page.on("pageerror", error => browserErrors.push(`page: ${error.message}`));

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: browserTimeoutMs });
    await page.waitForFunction(
        expectedPort => {
            const turns = window.cbReactApp?.state?.system?.networkingTurns;
            const numericTurns = Object.values(turns ?? {}).filter(Number.isFinite);
            const canvas = document.querySelector("canvas");
            const errorOverlay = document.getElementById("errors");

            return (
                window.cbNetworkSettings?.simulationPort === expectedPort
                && typeof window.cbRustBrowser?.start === "function"
                && numericTurns.length >= 2
                && numericTurns.every(turn => turn > 0)
                && canvas?.width > 0
                && canvas?.height > 0
                && canvas?.clientWidth > 0
                && canvas?.clientHeight > 0
                && !errorOverlay?.classList.contains("errorsHappened")
            );
        },
        expectedSimulationPort,
        { timeout: browserTimeoutMs },
    );

    const initialTurns = await page.evaluate(
        () => ({ ...window.cbReactApp.state.system.networkingTurns }),
    );

    await page.waitForFunction(
        previousTurns => {
            const currentTurns = window.cbReactApp?.state?.system?.networkingTurns ?? {};
            return Object.entries(previousTurns).every(
                ([machine, previous]) => currentTurns[machine] > previous,
            );
        },
        initialTurns,
        { timeout: browserTimeoutMs },
    );

    const state = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        return {
            canvas: {
                width: canvas.width,
                height: canvas.height,
                clientWidth: canvas.clientWidth,
                clientHeight: canvas.clientHeight,
            },
            errorOverlayClass: document.getElementById("errors")?.className ?? "",
            networkingTurns: { ...window.cbReactApp.state.system.networkingTurns },
            title: document.title,
        };
    });

    if (state.title !== "Citybound") {
        throw new Error(`Expected page title Citybound, got ${JSON.stringify(state.title)}.`);
    }
    if (masterPlanUpdates === 0) {
        throw new Error("The browser did not receive a master-plan update.");
    }
    if (browserErrors.length > 0) {
        throw new Error(`Browser errors were reported:\n${browserErrors.join("\n")}`);
    }

    console.log(
        "Browser smoke passed:",
        `${url} rendered ${state.canvas.clientWidth}x${state.canvas.clientHeight},`,
        `network turns advanced to ${JSON.stringify(state.networkingTurns)}.`,
    );
} catch (error) {
    console.error(error.message);
    if (serverLog) {
        console.error("\nCitybound server log:\n", serverLog);
    }
    process.exitCode = 1;
} finally {
    await cleanup();
    removeSignalCleanup();
}
