#!/usr/bin/env node

import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import { installSignalCleanup } from "./signal-cleanup.mjs";
import { roadGeometry } from "./road-reload-geometry.mjs";
import { firstTownState, validateFirstTown, assertFirstTownContinuity } from "./first-town-continuity.mjs";

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
const testRoadReload = process.argv.includes("--road-reload");
const roadEvidenceDir = process.env.CITYBOUND_ROAD_EVIDENCE_DIR;
const testConnectedTown = process.argv.includes("--connected-town");
const recoveryDir = process.env.CITYBOUND_CONTINUITY_RECOVERY_DIR;
const testContinuity = process.argv.includes("--first-town-continuity") || !!recoveryDir;
const testFirstTown = testContinuity || process.argv.includes("--first-town") || testConnectedTown;
const testFamilyHouseReload = process.argv.includes("--family-house-reload") || testFirstTown;
const testZoneReload = process.argv.includes("--zone-reload") || testFamilyHouseReload;

let browser;
let server;
let temporaryCityDir;
let serverLog = "";
let cleanupPromise;
let continuityDir;
let continuityManifest;
let continuityBefore;
const serverLogs = [];
const binarySha256 = async () => createHash("sha256").update(await readFile(serverPath)).digest("hex");
async function browserSha256() {
    const root = join(repoRoot, "cb_browser_ui", "dist");
    const hash = createHash("sha256");
    for (const name of (await readdir(root)).sort()) {
        hash.update(name).update("\0").update(await readFile(join(root, name))).update("\0");
    }
    return hash.digest("hex");
}

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
    if (!stopped) process.exitCode = 1;

    if (continuityDir) {
        console.log(`Continuity save and evidence preserved at ${continuityDir}.`);
    } else if (temporaryCityDir && stopped) {
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
    if (testRoadReload && testZoneReload) {
        throw new Error("Run road and zoning reload probes separately.");
    }
    if ((testZoneReload || testRoadReload) && explicitCityDir) {
        throw new Error("Reload regression requires its own disposable city.");
    }
    await access(serverPath);
    await access(join(repoRoot, "cb_browser_ui", "dist", "index.html"));

    if (testContinuity) {
        if (testConnectedTown || testRoadReload || explicitCityDir) {
            throw new Error("First-town continuity requires its own residential fixture.");
        }
        const evidenceDir = recoveryDir ? resolve(recoveryDir)
            : await mkdtemp(join(tmpdir(), "citybound-first-town-continuity-"));
        if (evidenceDir === repoRoot || evidenceDir.startsWith(`${repoRoot}/`)) {
            throw new Error("Continuity evidence must be outside the repository.");
        }
        if (recoveryDir) {
            continuityManifest = JSON.parse(await readFile(join(evidenceDir, "manifest.json"), "utf8"));
            if (continuityManifest.fixture !== "citybound-first-town-continuity-v1"
                || continuityManifest.binarySha256 !== await binarySha256()
                || continuityManifest.browserSha256 !== await browserSha256()
                || continuityManifest.cityDir !== join(evidenceDir, "city")
                || continuityManifest.phase !== "safe-first-shutdown") {
                throw new Error("Recovery requires this probe's safely stopped fixture and identical binary.");
            }
            continuityDir = evidenceDir;
            continuityBefore = JSON.parse(await readFile(join(continuityDir, "before-reload.json"), "utf8"));
            validateFirstTown(continuityBefore);
        } else {
            continuityDir = evidenceDir;
            continuityManifest = {
                fixture: "citybound-first-town-continuity-v1",
                acceptedBaseline: "f804d15c4c6ab4b713c7c8a2422b3e94a9c61fcc",
                sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim(),
                binarySha256: await binarySha256(), browserSha256: await browserSha256(), cityDir: join(continuityDir, "city"), phase: "building",
            };
            await writeFile(join(continuityDir, "manifest.json"), JSON.stringify(continuityManifest, null, 2));
        }
    }
    const cityDir = testContinuity ? continuityManifest.cityDir :
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

    if (testRoadReload) {
        const projectId = "00000000-0000-4000-8000-000000000008";
        const gestureId = "00000000-0000-4000-8000-000000000800";
        const snapshots = {};
        const logs = [];
        if (roadEvidenceDir) await mkdir(roadEvidenceDir, { recursive: true });

        const hasRoad = () => {
            const rendering = window.cbReactApp?.state?.transport?.rendering;
            const indexCount = layer => [...(rendering?.[layer]?.values() ?? [])]
                .reduce((count, mesh) => count + mesh.indices.length, 0);
            // Two straight lanes plus the generated endpoint turnarounds.
            return indexCount("laneAsphaltGroups") === 132
                && indexCount("laneMarkerGroups") === 24;
        };
        const capture = async (activePage, label) => {
            try {
                await activePage.waitForFunction(hasRoad, undefined, { timeout: browserTimeoutMs });
            } catch (error) {
                console.error(`${label} road geometry:`, await activePage.evaluate(roadGeometry));
                throw error;
            }
            await activePage.evaluate(() => {
                document.querySelector(".window.menu .close-window")?.click();
                window.cbReactApp.boundSetState(old => ({
                    ...old, uiMode: "inspection", camera: { ...old.camera, target: [-270, -300, 0] },
                }));
            });
            await activePage.waitForFunction(() => window.cbReactApp.state.uiMode === "inspection");
            const planning = await activePage.evaluate(() => ({
                currentProject: window.cbReactApp.state.planning.currentProject,
                projects: Object.keys(window.cbReactApp.state.planning.projects),
            }));
            if (planning.currentProject != null || planning.projects.length !== 0) {
                throw new Error(`${label}: a planning project remains active.`);
            }
            const geometry = await activePage.evaluate(roadGeometry);
            const gestureHandle = await activePage.waitForFunction(id =>
                window.cbReactApp.state.planning.master.gestures[id] || false,
            gestureId, { timeout: browserTimeoutMs });
            const gesture = await gestureHandle.jsonValue();
            await gestureHandle.dispose();
            snapshots[label] = {
                gesture,
                geometry: Object.fromEntries(Object.entries(geometry).map(([layer, triangles]) =>
                    [layer, { triangles: triangles.length,
                        sha256: createHash("sha256").update(JSON.stringify(triangles)).digest("hex") }])),
            };
            // Let the renderer consume the state before recording the visible surface.
            await activePage.evaluate(() => new Promise(resolveFrame =>
                requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
            if (roadEvidenceDir) {
                await activePage.screenshot({ path: join(roadEvidenceDir, `${label}.png`) });
                await writeFile(join(roadEvidenceDir, `${label}.json`),
                    JSON.stringify({ ...snapshots[label], triangles: geometry }, null, 2));
            }
            if (label !== "before-reload"
                && JSON.stringify(snapshots[label]) !== JSON.stringify(snapshots["before-reload"])) {
                throw new Error(`${label}: authoritative gesture or constructed road geometry changed.`);
            }
            console.log(`Road regression ${label}: ${JSON.stringify(snapshots[label])}`);
        };

        const initialGeometry = await page.evaluate(roadGeometry);
        if (initialGeometry.laneAsphaltGroups.length !== 0) {
            throw new Error("Disposable city unexpectedly already contains asphalt.");
        }
        await page.evaluate(({ projectId, gestureId }) => {
            window.cbRustBrowser.start_new_project(projectId);
            let intent = { Road: window.cbRustBrowser.new_road_intent(1, 1) };
            for (const point of [[-320, -300], [-220, -300]]) {
                intent = window.cbRustBrowser.with_control_point_added(intent, point, true);
            }
            window.cbRustBrowser.start_new_gesture(projectId, gestureId, intent);
            window.cbReactApp.boundSetState(old => ({
                ...old, planning: { ...old.planning, currentProject: projectId },
            }));
        }, { projectId, gestureId });
        await page.waitForFunction(() => [...window.cbReactApp.state.planning.rendering
            .currentPreview.lanesToConstructGroups.values()].some(mesh => mesh.indices.length > 0),
        undefined, { timeout: browserTimeoutMs });
        await page.evaluate(id => {
            window.cbRustBrowser.implement_project(id);
            window.cbReactApp.boundSetState(old => ({
                ...old, planning: { ...old.planning, currentProject: null },
            }));
        }, projectId);
        await page.waitForFunction(({ projectId, gestureId }) =>
            window.cbReactApp.state.planning.projects[projectId] == null
            && window.cbReactApp.state.planning.master.gestures[gestureId] != null,
        { projectId, gestureId }, { timeout: browserTimeoutMs });
        await capture(page, "before-reload");

        await page.reload({ waitUntil: "domcontentloaded", timeout: browserTimeoutMs });
        await page.waitForFunction(() => window.cbReactApp?.state?.planning?.master?.gestures[
            "00000000-0000-4000-8000-000000000800"] != null,
        undefined, { timeout: browserTimeoutMs });
        await capture(page, "page-reload");
        await page.close();
        if (!await stopServer()) throw new Error("Could not stop road regression server.");
        if (server.exitCode !== 0 || !serverLog.includes("Stopping Citybound safely...")) {
            throw new Error("Road regression did not complete a clean first shutdown.");
        }
        logs.push(serverLog);
        const saveInventory = (await readdir(cityDir)).sort();
        if (!saveInventory.includes("Lane_n")) throw new Error("Save is missing Lane actor storage.");
        serverLog = "";
        await startServer(cityDir);
        if (!serverLog.includes("Loading from savegame")) throw new Error("Server did not load save.");
        const restored = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        restored.on("pageerror", error => browserErrors.push(`reload page: ${error.message}`));
        restored.on("console", message => {
            if (message.type() === "error") browserErrors.push(`reload console: ${message.text()}`);
        });
        await restored.goto(url, { waitUntil: "domcontentloaded", timeout: browserTimeoutMs });
        await restored.waitForFunction(() => window.cbReactApp?.state?.planning?.master?.gestures[
            "00000000-0000-4000-8000-000000000800"] != null,
        undefined, { timeout: browserTimeoutMs });
        await capture(restored, "server-restart");
        await restored.close();
        if (!await stopServer() || server.exitCode !== 0
            || !serverLog.includes("Stopping Citybound safely...")) {
            throw new Error("Road regression did not complete a clean second shutdown.");
        }
        logs.push(serverLog);
        if (roadEvidenceDir) {
            await writeFile(join(roadEvidenceDir, "server-first.log"), logs[0].replace(/[ \t]+$/gm, ""));
            await writeFile(join(roadEvidenceDir, "server-restart.log"), logs[1].replace(/[ \t]+$/gm, ""));
            await writeFile(join(roadEvidenceDir, "result.json"), JSON.stringify({
                snapshots, saveInventory, browserErrors, bind, bindSimulation,
            }, null, 2));
        }
        if (browserErrors.length > 0) throw new Error(browserErrors.join("\n"));
        console.log("Road reload passed: identical master gesture, asphalt and marker triangles after page reload and clean save/server restart; no browser errors.");
    }

    if (testZoneReload) {
        let houseIds = [];
        const townSnapshots = {};
        const townEvidenceDir = continuityDir ?? process.env.CITYBOUND_FIRST_TOWN_EVIDENCE_DIR;
        const captureContinuity = async (target, phase) => {
            await target.waitForFunction(() => window.cbReactApp.state.time.speed === 0,
                undefined, { timeout: browserTimeoutMs });
            // Allow outstanding simulation replies and the 500ms household refresh to drain.
            const turns = await target.evaluate(() => ({ ...window.cbReactApp.state.system.networkingTurns }));
            await target.waitForFunction(previous => Object.entries(previous).every(([id, turn]) =>
                window.cbReactApp.state.system.networkingTurns[id] > turn + 3),
            turns, { timeout: browserTimeoutMs });
            await target.waitForTimeout(1_000);
            const snapshot = await target.evaluate(firstTownState);
            snapshot.roads = await target.evaluate(roadGeometry);
            await writeFile(join(continuityDir, `${phase}.json`), JSON.stringify(snapshot, null, 2));
            validateFirstTown(snapshot);
            const presentation = await target.evaluate(() => ({
                currentProject: window.cbReactApp.state.planning.currentProject,
                projects: Object.keys(window.cbReactApp.state.planning.projects),
                errorOverlay: document.getElementById("errors")?.classList.contains("errorsHappened"),
            }));
            if (presentation.currentProject != null || presentation.projects.length || presentation.errorOverlay) {
                throw new Error(`${phase}: unexpected continuity presentation ${JSON.stringify(presentation)}`);
            }
            if (continuityBefore) assertFirstTownContinuity(continuityBefore, snapshot, phase);
            else continuityBefore = snapshot;
            console.log(`First-town continuity ${phase}: ${Object.keys(snapshot.buildings).length} buildings, ${Object.keys(snapshot.households).length} households, paused tick ${snapshot.ticks}; exact semantic state and geometry matched.`);
        };
        const checkTown = async (target, phase) => {
            await target.waitForFunction(() => Object.values(window.cbReactApp.state.households.buildings)
                .some(b => b.style === "FamilyHouse" && b.households.length > 0),
                undefined, { timeout: Math.max(browserTimeoutMs, 90_000) });
            await target.evaluate(() => window.cbRustBrowser.set_sim_speed(0));
            await target.locator('.window.menu .close-window').click();
            const id = await target.evaluate(() => Object.entries(window.cbReactApp.state.households.buildings)
                .find(([, b]) => b.style === "FamilyHouse" && b.households.length > 0)[0]);
            await target.locator(`[data-town-building="${id}"]`).click();
            await target.waitForFunction(id => {
                const s = window.cbReactApp.state;
                return s.uiMode === "inspection" && s.households.inspectedBuilding === id
                    && s.households.inspectedBuildingPinned
                    && s.households.inspectedBuildingState?.households.length > 0
                    && s.households.inspectedBuildingState.households.every(h => s.households.householdInfo[h]);
            }, id, { timeout: browserTimeoutMs });
            townSnapshots[phase] = await target.evaluate(() => ({
                counts: document.querySelector('[data-town-counts]').textContent,
                buildings: window.cbReactApp.state.households.buildings,
                selected: window.cbReactApp.state.households.inspectedBuilding,
                inspector: document.querySelector('.window.building').innerText,
                target: window.cbReactApp.state.camera.target,
                position: window.cbReactApp.state.households.buildingPositions[window.cbReactApp.state.households.inspectedBuilding],
            }));
            const snapshot = townSnapshots[phase];
            const town = Object.values(snapshot.buildings).filter(b => b.style !== "NeighboringTownConnection");
            const occupied = town.filter(b => b.households.length > 0).length;
            const households = new Set(town.flatMap(b => b.households)).size;
            const expected = `Buildings: ${town.length} · Occupied: ${occupied} · Households: ${households}`;
            if (snapshot.counts !== expected || snapshot.target[0] !== snapshot.position[0]
                || snapshot.target[1] !== snapshot.position[1] || !snapshot.inspector.includes("Member 0")) {
                throw new Error(`Town panel mismatch: ${JSON.stringify(snapshot)}`);
            }
            if (townEvidenceDir) {
                await mkdir(townEvidenceDir, { recursive: true });
                await target.screenshot({ path: join(townEvidenceDir, `${phase}.png`) });
                await writeFile(join(townEvidenceDir, "town.json"), JSON.stringify(townSnapshots, null, 2));
            }
            console.log(`First town ${phase}: ${snapshot.counts}; focus and household inspection passed.`);
        };
        const hasHouseMeshes = ids => ids.every(id =>
            ["WhiteWall", "TiledRoof", "WoodenFence"].every(material => {
                const mesh = window.cbReactApp.state.landUse.rendering.buildingMeshes[material][id];
                return mesh?.vertices.length > 0 && mesh?.indices.length > 0;
            }));
        const renderedHouseIds = () => Object.entries(
            window.cbReactApp.state.landUse.rendering.buildingMeshes.WoodenFence,
        ).filter(([, mesh]) => mesh.vertices.length > 0 && mesh.indices.length > 0)
            .map(([id]) => id).sort();
        const hasZoneMeshes = () => {
            const preview = window.cbReactApp?.state?.planning?.rendering?.currentPreview;
            return [preview?.zoneGroups, preview?.zoneOutlineGroups].every(
                batches => [...(batches?.get("Residential")?.values() ?? [])]
                    .some(mesh => mesh.vertices.length > 0 && mesh.indices.length > 0),
            );
        };
        if (recoveryDir) {
            houseIds = Object.keys(continuityBefore.buildings);
            await page.waitForFunction(() => window.cbReactApp.state.time.speed === 0,
                undefined, { timeout: browserTimeoutMs });
            await checkTown(page, "recovered");
            await captureContinuity(page, "recovered");
        } else {
            if (testFamilyHouseReload) {
                // A straight road beside the fixed residential polygon permits normal
                // immigration/development; no actor state or save files are injected.
                await page.evaluate(connected => {
                    const id = "00000000-0000-4000-8000-000000000062";
                    window.cbRustBrowser.start_new_project(id);
                    let intent = { Road: window.cbRustBrowser.new_road_intent(1, 1) };
                    for (const point of [[-320, -300], [-220, -300]]) {
                        intent = window.cbRustBrowser.with_control_point_added(intent, point, true);
                    }
                    window.cbRustBrowser.start_new_gesture(id,
                        "00000000-0000-4000-8000-000000006200", intent);
                    if (connected) {
                        let junction = { Road: window.cbRustBrowser.new_road_intent(1, 1) };
                        for (const point of [[-220, -400], [-220, -200]]) {
                            junction = window.cbRustBrowser.with_control_point_added(junction, point, true);
                        }
                        window.cbRustBrowser.start_new_gesture(id,
                            "00000000-0000-4000-8000-000000006201", junction);
                    }
                    window.cbReactApp.boundSetState(old => ({
                        ...old, planning: { ...old.planning, currentProject: id },
                    }));
                }, testConnectedTown || testContinuity);
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
                if (testContinuity) {
                    await page.waitForFunction(() => {
                        const r = window.cbReactApp.state.transport.rendering;
                        const count = layer => [...r[layer].values()].reduce((n, mesh) => n + mesh.indices.length, 0);
                        return count("laneAsphaltGroups") >= 132 && count("laneMarkerGroups") >= 24
                            && window.cbReactApp.state.planning.master.gestures[
                                "00000000-0000-4000-8000-000000006201"] != null;
                    }, undefined, { timeout: browserTimeoutMs });
                }
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

            if (testContinuity) {
                await writeFile(join(continuityDir, "fixture-ready.json"), JSON.stringify({
                    roads: await page.evaluate(roadGeometry),
                    planning: await page.evaluate(() => window.cbReactApp.state.planning.master),
                    time: await page.evaluate(() => window.cbReactApp.state.time),
                }, null, 2));
            }
            if (testFamilyHouseReload) {
                await page.evaluate(speed => window.cbRustBrowser.set_sim_speed(speed), testContinuity ? 32 : 10);
                await page.waitForFunction(() => Object.values(
                    window.cbReactApp.state.landUse.rendering.buildingMeshes.WoodenFence,
                ).some(mesh => mesh.vertices.length > 0 && mesh.indices.length > 0),
                undefined, { timeout: Math.max(browserTimeoutMs, 90_000) });
                if (testFirstTown) await checkTown(page, "developed");
                await page.evaluate(() => window.cbRustBrowser.set_sim_speed(0));
                houseIds = await page.evaluate(renderedHouseIds);
                console.log(`FamilyHouse regression: developed houses ${JSON.stringify(houseIds)}.`);
            }

            if (testContinuity) await captureContinuity(page, "before-reload");
        }

        let connectedTraveler;
        const sampledTownTraveler = () => {
            const s = window.cbReactApp.state;
            // A commercial supply trip is as real as a family commute. Exclude
            // road boundary households and manually created/debug traffic.
            const buildings = Object.values(s.households.buildings)
                .filter(b => b.style !== "NeighboringTownConnection")
                .sort((a, b) => Number(a.style === "FamilyHouse") - Number(b.style === "FamilyHouse"));
            for (const b of buildings) {
                for (const h of b.households) {
                    const tasks = s.households.householdInfo[h]?.core.member_tasks ?? [];
                    const member = tasks.findIndex(t => t.state.InTrip
                        && document.querySelector(`[data-town-trip="${t.state.InTrip}"]`));
                    if (member >= 0) return { household: h, member,
                        trip: tasks[member].state.InTrip, originStyle: b.style,
                        destination: tasks[member].goal[1].household };
                }
            }
        };
        const checkConnectedTrip = async (target, phase) => {
            if (phase === "developed") await target.evaluate(() => window.cbRustBrowser.set_sim_speed(4));
            await target.waitForFunction(sampledTownTraveler,
                undefined, { timeout: browserTimeoutMs });
            // Pause so clicking the row centers on the exact sampled car.
            await target.evaluate(() => window.cbRustBrowser.set_sim_speed(0));
            await target.waitForTimeout(800);
            const traveler = await target.evaluate(sampledTownTraveler);
            if (!traveler) throw new Error("Town household trip ended before pause.");
            const { trip } = traveler;
            if (connectedTraveler && connectedTraveler.trip !== trip) {
                throw new Error("Reload did not restore the same in-flight household trip.");
            }
            connectedTraveler = traveler;
            const first = await target.evaluate(trip => ({
                position: window.cbReactApp.state.transport.roadTrips.find(([id]) => id === trip)[1],
                text: document.querySelector(`[data-town-trip="${trip}"]`).textContent,
                households: window.cbReactApp.state.households.householdInfo,
                buildings: window.cbReactApp.state.households.buildings,
            }), trip);
            await target.locator(`[data-town-trip="${trip}"]`).click();
            const focused = await target.evaluate(() => window.cbReactApp.state.camera.target);
            if (focused[0] !== first.position[0] || focused[1] !== first.position[1]) {
                throw new Error("Trip row failed to center on its sampled car.");
            }
            if (townEvidenceDir) {
                await target.screenshot({ path: join(townEvidenceDir, `${phase}-trip.png`) });
            }
            if (phase !== "server-restart") {
                townSnapshots[`${phase}-trip`] = { traveler, first, focused };
                if (townEvidenceDir) await writeFile(join(townEvidenceDir, "town.json"), JSON.stringify(townSnapshots, null, 2));
                console.log(`Connected town ${phase}: ${trip} (${traveler.originStyle}), ${first.text}; centered on the road car, paused for reload.`);
                return;
            }
            await target.evaluate(() => window.cbRustBrowser.set_sim_speed(1));
            await target.waitForFunction(({ trip, previous }) => {
                const car = window.cbReactApp.state.transport.roadTrips.find(([id]) => id === trip);
                return car && Math.hypot(car[1][0] - previous[0], car[1][1] - previous[1]) > 0.5;
            }, { trip, previous: first.position }, { timeout: browserTimeoutMs });
            const moved = await target.evaluate(trip => window.cbReactApp.state.transport.roadTrips
                .find(([id]) => id === trip)[1], trip);
            await target.waitForFunction(({ trip, household, member, destination }) => {
                const state = window.cbReactApp.state;
                const task = state.households.householdInfo[household]?.core.member_tasks[member];
                return task?.state.StartedAt?.[1] === destination && !state.transport.roadTrips.some(([id]) => id === trip)
                    && !document.querySelector(`[data-town-trip="${trip}"]`);
            }, traveler, { timeout: browserTimeoutMs });
            await target.evaluate(() => window.cbRustBrowser.set_sim_speed(0));
            townSnapshots[`${phase}-trip`] = { traveler, first, moved, focused };
            if (townEvidenceDir) await writeFile(join(townEvidenceDir, "town.json"), JSON.stringify(townSnapshots, null, 2));
            console.log(`Connected town ${phase}: ${trip} (${traveler.originStyle}), ${first.text}; moved ${JSON.stringify(first.position)} -> ${JSON.stringify(moved)}, centered and arrived and started its destination activity.`);
        };
        if (testConnectedTown) {
            await page.locator('#planning').click();
            // Commercial frontage on the opposite side of the same built road.
            await page.evaluate(() => {
                const id = "00000000-0000-4000-8000-000000000040";
                window.cbRustBrowser.set_sim_speed(1);
                window.cbRustBrowser.start_new_project(id);
                let intent = { Zone: window.cbRustBrowser.new_zone_intent("Commercial") };
                for (const point of [[-300, -300], [-240, -300], [-240, -360], [-300, -360]]) {
                    intent = window.cbRustBrowser.with_control_point_added(intent, point, true);
                }
                window.cbRustBrowser.start_new_gesture(id, "00000000-0000-4000-8000-000000004000", intent);
                window.cbReactApp.boundSetState(old => ({ ...old,
                    planning: { ...old.planning, currentProject: id } }));
            });
            await page.waitForFunction(() => [...(window.cbReactApp.state.planning.rendering
                .currentPreview.zoneGroups.get("Commercial")?.values() ?? [])]
                .some(m => m.indices.length > 0), undefined, { timeout: browserTimeoutMs });
            await page.evaluate(() => {
                window.cbRustBrowser.implement_project("00000000-0000-4000-8000-000000000040");
                window.cbReactApp.boundSetState(old => ({ ...old,
                    planning: { ...old.planning, currentProject: null } }));
                window.cbRustBrowser.set_sim_speed(10);
            });
            await page.waitForFunction(() => Object.values(window.cbReactApp.state.households.buildings)
                .some(b => ["GroceryShop", "Mill", "Bakery"].includes(b.style) && b.households.length > 0),
                undefined, { timeout: Math.max(browserTimeoutMs, 180_000) });
            const mixedUse = await page.evaluate(() => ({
                buildings: window.cbReactApp.state.households.buildings,
                households: window.cbReactApp.state.households.householdInfo,
                roadTrips: window.cbReactApp.state.transport.roadTrips,
                time: window.cbReactApp.state.time,
            }));
            townSnapshots["mixed-use"] = mixedUse;
            if (townEvidenceDir) await writeFile(join(townEvidenceDir, "town.json"), JSON.stringify(townSnapshots, null, 2));
            console.log("Connected town: occupied residential and commercial development on the built road.");
            await checkConnectedTrip(page, "developed");
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
            if (testFirstTown) await checkTown(page, "page-reload");
            if (testContinuity) await captureContinuity(page, "page-reload");
            if (testConnectedTown) await checkConnectedTrip(page, "page-reload");
            console.log("FamilyHouse regression: page reload restored developed house meshes.");
        }
        console.log("Zone regression: page reload restored geometry without a project.");

        // Restart only this probe's server, then reconnect a fresh browser page
        // to the same disposable mmap save. No preview project is requested.
        await page.close();
        if (!await stopServer()) throw new Error("Could not stop zone regression server.");
        if (testContinuity) {
            if (server.exitCode !== 0 || !serverLog.includes("Stopping Citybound safely...")) {
                throw new Error("First-town continuity requires a clean SIGINT shutdown.");
            }
            serverLogs.push(serverLog);
            await writeFile(join(continuityDir, recoveryDir ? "server-recovery.log" : "server-first.log"), serverLog);
            const saveInventory = (await readdir(cityDir)).sort();
            for (const required of ["Time_n", "PlanManager(CBPlanningLogic)_n", "Lane_n", "Building_n", "Family_n"]) {
                if (!saveInventory.includes(required)) throw new Error(`Missing continuity actor storage ${required}.`);
            }
            const versionMarker = await readFile(join(cityDir, "__cb_version.txt"), "utf8");
            if (recoveryDir && versionMarker !== continuityManifest.versionMarker) {
                throw new Error("Recovery changed the saved build marker.");
            }
            continuityManifest.saveInventory ??= saveInventory;
            continuityManifest.versionMarker ??= versionMarker;
            continuityManifest.phase = "safe-first-shutdown";
            await writeFile(join(continuityDir, "manifest.json"), JSON.stringify(continuityManifest, null, 2));
            if (process.env.CITYBOUND_CONTINUITY_FAIL_AFTER_SAVE === "1") {
                throw new Error("Injected continuity harness failure after safe shutdown; recover the retained same-binary fixture.");
            }
        }
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
            if (testFirstTown) await checkTown(restored, "server-restart");
            if (testContinuity) {
                if (!serverLog.includes("Loading from savegame") || serverLog.includes("not found, creating")
                    || serverLog.includes("POTENTIALLY INCOMPATIBLE SAVEGAME")) {
                    throw new Error("Continuity restart must load the identical-version save.");
                }
                await captureContinuity(restored, "server-restart");
                await restored.evaluate(() => window.cbRustBrowser.set_sim_speed(4));
                await restored.waitForFunction(before => {
                    const s = window.cbReactApp.state;
                    return s.time.ticks > before.ticks
                        && JSON.stringify(s.time.time) !== JSON.stringify(before.time)
                        && Object.entries(before.households).some(([id, core]) =>
                            JSON.stringify(s.households.householdInfo[id]?.core.member_resources)
                                !== JSON.stringify(core.member_resources));
                }, continuityBefore, { timeout: browserTimeoutMs });
                await restored.evaluate(() => window.cbRustBrowser.set_sim_speed(0));
                await restored.waitForFunction(() => window.cbReactApp.state.time.speed === 0,
                    undefined, { timeout: browserTimeoutMs });
                const advanced = await restored.evaluate(() => ({ ...window.cbReactApp.state.time,
                    visibleClock: document.querySelector(".sim-time").innerText,
                    inspector: document.querySelector(".window.building").innerText,
                    households: window.cbReactApp.state.households.householdInfo }));
                await writeFile(join(continuityDir, "advanced.json"), JSON.stringify(advanced, null, 2));
                await restored.screenshot({ path: join(continuityDir, "advanced.png") });
                await restored.close();
                if (!await stopServer() || server.exitCode !== 0
                    || !serverLog.includes("Stopping Citybound safely...")) {
                    throw new Error("Continuity restart did not stop safely.");
                }
                if (await binarySha256() !== continuityManifest.binarySha256
                    || await browserSha256() !== continuityManifest.browserSha256) {
                    throw new Error("Native binary or browser assets changed during continuity probe.");
                }
                const inventory = await readdir(cityDir);
                if (continuityManifest.saveInventory.some(name => !inventory.includes(name))
                    || await readFile(join(cityDir, "__cb_version.txt"), "utf8") !== continuityManifest.versionMarker) {
                    throw new Error("Continuity reload changed the version marker or removed actor storage.");
                }
                await writeFile(join(continuityDir, "server-restart.log"), serverLog);
                if (browserErrors.length > 0) throw new Error(browserErrors.join("\n"));
                continuityManifest.phase = "passed";
                await writeFile(join(continuityDir, "manifest.json"), JSON.stringify(continuityManifest, null, 2));
                console.log(`First-town continuity passed: same paused state survived restart; simulation advanced from tick ${continuityBefore.ticks} to ${advanced.ticks}, visible clock ${advanced.visibleClock.trim()}.`);
            }
            if (testConnectedTown) await checkConnectedTrip(restored, "server-restart");
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
    if (continuityDir) {
        await writeFile(join(continuityDir, "failure.json"), JSON.stringify({
            message: error.stack ?? error.message, serverLog, serverLogs,
            cityDir: continuityManifest?.cityDir,
        }, null, 2));
        const diagnosticPage = browser?.contexts()[0]?.pages()[0];
        if (diagnosticPage && !diagnosticPage.isClosed()) {
            await diagnosticPage.screenshot({ path: join(continuityDir, "failure.png"), timeout: 5_000 }).catch(() => {});
            const state = await diagnosticPage.evaluate(() => {
                const s = window.cbReactApp?.state;
                return { time: s?.time, buildings: s?.households.buildings,
                    households: s?.households.householdInfo, master: s?.planning.master,
                    networkingTurns: s?.system.networkingTurns };
            }).catch(error => ({ unavailable: error.message }));
            await writeFile(join(continuityDir, "failure-state.json"), JSON.stringify(state, null, 2));
        }
    }
    process.exitCode = 1;
} finally {
    await cleanup();
    removeSignalCleanup();
}
