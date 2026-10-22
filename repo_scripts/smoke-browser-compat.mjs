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
const testFamilyHouseReload = process.argv.includes("--family-house-reload");
const testZoneReload = process.argv.includes("--zone-reload") || testFamilyHouseReload;

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

async function startServer(cityDir) {
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
    if (testZoneReload && explicitCityDir) {
        throw new Error("Zone reload regression requires its own disposable city.");
    }
    await access(serverPath);
    await access(join(repoRoot, "cb_browser_ui", "dist", "index.html"));

    const cityDir =
        explicitCityDir
        ?? (temporaryCityDir = await mkdtemp(join(tmpdir(), "citybound-browser-smoke-")));

    await startServer(cityDir);

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

    await page.evaluate(() => document.getElementById("planning")?.click());
    await page.waitForFunction(
        () => (
            window.cbReactApp?.state?.uiMode === "planning"
            && window.cbReactApp?.state?.planning?.currentProject == null
            && document.querySelector(
                '[data-citybound-zone-layers="persistent"]',
            ) != null
        ),
        undefined,
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
            persistentZoneLayersMounted:
                document.querySelector(
                    '[data-citybound-zone-layers="persistent"]',
                ) != null,
        };
    });

    if (state.title !== "Citybound") {
        throw new Error(`Expected page title Citybound, got ${JSON.stringify(state.title)}.`);
    }
    if (masterPlanUpdates === 0) {
        throw new Error("The browser did not receive a master-plan update.");
    }
    if (!state.persistentZoneLayersMounted) {
        throw new Error(
            "Zone planning layers unmounted when no planning project was active.",
        );
    }
    if (browserErrors.length > 0) {
        throw new Error(`Browser errors were reported:\n${browserErrors.join("\n")}`);
    }

    if (testZoneReload) {
        let houseIds = [];
        const hasHouseMeshes = ids => ids.every(id =>
            ["WhiteWall", "TiledRoof", "WoodenFence"].every(material => {
                const mesh = window.cbReactApp.state.landUse.rendering.buildingMeshes[material][id];
                return mesh?.vertices.length > 0 && mesh?.indices.length > 0;
            }));
        const renderedHouseIds = () => Object.entries(
            window.cbReactApp.state.landUse.rendering.buildingMeshes.WoodenFence,
        ).filter(([, mesh]) => mesh.vertices.length > 0 && mesh.indices.length > 0)
            .map(([id]) => id).sort();
        if (testFamilyHouseReload) {
            // A straight road beside the fixed residential polygon permits normal
            // immigration/development; no actor state or save files are injected.
            await page.evaluate(() => {
                const id = "00000000-0000-4000-8000-000000000062";
                window.cbRustBrowser.start_new_project(id);
                let intent = { Road: window.cbRustBrowser.new_road_intent(1, 1) };
                for (const point of [[-320, -300], [-220, -300]]) {
                    intent = window.cbRustBrowser.with_control_point_added(intent, point, true);
                }
                window.cbRustBrowser.start_new_gesture(id,
                    "00000000-0000-4000-8000-000000006200", intent);
                window.cbReactApp.boundSetState(old => ({
                    ...old, planning: { ...old.planning, currentProject: id },
                }));
            });
            await page.waitForFunction(() => [...window.cbReactApp.state.planning
                .rendering.currentPreview.lanesToConstructGroups.values()]
                .some(mesh => mesh.vertices.length > 0 && mesh.indices.length > 0),
                undefined, { timeout: browserTimeoutMs });
            console.log("FamilyHouse regression: road preview received.");
            await page.evaluate(() => {
                window.cbRustBrowser.implement_project("00000000-0000-4000-8000-000000000062");
                window.cbReactApp.boundSetState(old => ({
                    ...old, planning: { ...old.planning, currentProject: null },
                }));
            });
            await page.waitForFunction(() =>
                window.cbReactApp.state.planning.projects[
                    "00000000-0000-4000-8000-000000000062"] == null,
                undefined, { timeout: browserTimeoutMs });
        }
        console.log("Reload regression: creating residential zone.");
        // Use the same exported Rust commands as the planning UI, with fixed
        // geometry away from starter roads so this remains a zoning-only probe.
        const projectId = "00000000-0000-4000-8000-000000000064";
        await page.evaluate(id => {
            const gestureId = "00000000-0000-4000-8000-000000006400";
            window.cbRustBrowser.start_new_project(id);
            let intent = { Zone: window.cbRustBrowser.new_zone_intent("Residential") };
            for (const point of [[-300, -300], [-240, -300], [-240, -240], [-300, -240]]) {
                intent = window.cbRustBrowser.with_control_point_added(intent, point, true);
            }
            window.cbRustBrowser.start_new_gesture(id, gestureId, intent);
            window.cbReactApp.boundSetState(old => ({
                ...old, planning: { ...old.planning, currentProject: id },
            }));
        }, projectId);
        const hasZoneMeshes = () => {
            const preview = window.cbReactApp?.state?.planning?.rendering?.currentPreview;
            return [preview?.zoneGroups, preview?.zoneOutlineGroups].every(
                batches => [...(batches?.get("Residential")?.values() ?? [])]
                    .some(mesh => mesh.vertices.length > 0 && mesh.indices.length > 0),
            );
        };
        await page.waitForFunction(hasZoneMeshes, undefined, { timeout: browserTimeoutMs });
        console.log("Zone regression: preview geometry received.");
        await page.evaluate(id => {
            window.cbRustBrowser.implement_project(id);
            window.cbReactApp.boundSetState(old => ({
                ...old, planning: { ...old.planning, currentProject: null },
            }));
        }, projectId);
        await page.waitForFunction(id => (
            window.cbReactApp.state.planning.projects[id] == null
            && window.cbReactApp.state.planning.currentProject == null
            && window.cbReactApp.state.planning.master.gestures[
                "00000000-0000-4000-8000-000000006400"
            ] != null
        ), projectId, { timeout: browserTimeoutMs });
        await page.waitForFunction(hasZoneMeshes, undefined, { timeout: browserTimeoutMs });

        if (testFamilyHouseReload) {
            await page.evaluate(() => window.cbRustBrowser.set_sim_speed(10));
            await page.waitForFunction(() => Object.values(
                window.cbReactApp.state.landUse.rendering.buildingMeshes.WoodenFence,
            ).some(mesh => mesh.vertices.length > 0 && mesh.indices.length > 0),
            undefined, { timeout: Math.max(browserTimeoutMs, 90_000) });
            await page.evaluate(() => window.cbRustBrowser.set_sim_speed(0));
            houseIds = await page.evaluate(renderedHouseIds);
            console.log(`FamilyHouse regression: developed houses ${JSON.stringify(houseIds)}.`);
        }

        // A page reload starts with empty browser geometry and no current project.
        await page.reload({ waitUntil: "domcontentloaded", timeout: browserTimeoutMs });
        await page.waitForFunction(() => typeof window.cbRustBrowser?.start_new_project === "function",
            undefined, { timeout: browserTimeoutMs });
        await page.evaluate(() => document.getElementById("planning")?.click());
        await page.waitForFunction(hasZoneMeshes, undefined, { timeout: browserTimeoutMs });
        if (await page.evaluate(() => window.cbReactApp.state.planning.currentProject != null)) {
            throw new Error("Page reload unexpectedly selected a planning project.");
        }

        if (testFamilyHouseReload) {
            await page.waitForFunction(hasHouseMeshes, houseIds, { timeout: browserTimeoutMs });
            console.log("FamilyHouse regression: page reload restored developed house meshes.");
        }
        console.log("Zone regression: page reload restored geometry without a project.");

        // Restart only this probe's server, then reconnect a fresh browser page
        // to the same disposable mmap save. No preview project is requested.
        await page.close();
        if (!await stopServer()) throw new Error("Could not stop zone regression server.");
        serverLog = "";
        await startServer(cityDir);
        const restored = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        restored.on("pageerror", error => browserErrors.push(`reload page: ${error.message}`));
        restored.on("console", message => {
            if (message.type() === "error") browserErrors.push(`reload console: ${message.text()}`);
        });
        await restored.goto(url, { waitUntil: "domcontentloaded", timeout: browserTimeoutMs });
        await restored.waitForFunction(() => typeof window.cbRustBrowser?.start_new_project === "function",
            undefined, { timeout: browserTimeoutMs });
        await restored.evaluate(() => document.getElementById("planning")?.click());
        await restored.waitForFunction(hasZoneMeshes, undefined, { timeout: browserTimeoutMs });
        const restoredPlan = await restored.evaluate(() => ({
            mode: window.cbReactApp.state.uiMode,
            currentProject: window.cbReactApp.state.planning.currentProject,
            projects: Object.keys(window.cbReactApp.state.planning.projects),
            layers: !!document.querySelector('[data-citybound-zone-layers="persistent"]'),
        }));
        if (restoredPlan.mode !== "planning" || restoredPlan.currentProject != null
            || restoredPlan.projects.length !== 0 || !restoredPlan.layers) {
            throw new Error(`Unexpected restored zone state: ${JSON.stringify(restoredPlan)}`);
        }
        if (testFamilyHouseReload) {
            await restored.waitForFunction(hasHouseMeshes, houseIds, { timeout: browserTimeoutMs });
            console.log(`FamilyHouse regression: ${houseIds.length} developed houses restored after page reload and save/server restart.`);
        }
        if (browserErrors.length > 0) throw new Error(browserErrors.join("\n"));
        if (testFamilyHouseReload) console.log("FamilyHouse reload passed without browser errors.");
        console.log("Zone reload regression passed: filled and outlined residential meshes after page reload and save/server restart, with no active or dummy project.");
    }

    console.log(
        "Browser smoke passed:",
        `${url} rendered ${state.canvas.clientWidth}x${state.canvas.clientHeight},`,
        `network turns advanced to ${JSON.stringify(state.networkingTurns)}.`,
    );
} catch (error) {
    console.error(error.stack ?? error.message);
    if (serverLog) {
        console.error("\nCitybound server log:\n", serverLog);
    }
    process.exitCode = 1;
} finally {
    await cleanup();
    removeSignalCleanup();
}
