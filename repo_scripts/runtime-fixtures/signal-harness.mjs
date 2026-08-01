#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { rm, writeFile } from "node:fs/promises";

import { installSignalCleanup } from "../signal-cleanup.mjs";

const [fixture, readyFile, childPidFile, exitCodeFile] = process.argv.slice(2);
const child = spawn(
    process.execPath,
    ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
    { stdio: "ignore" },
);
await writeFile(childPidFile, String(child.pid));

let cleanupPromise;
async function cleanup() {
    cleanupPromise ??= (async () => {
        const childExited = () => child.exitCode !== null || child.signalCode !== null;
        child.kill("SIGTERM");
        await Promise.race([
            once(child, "exit"),
            new Promise(resolve => setTimeout(resolve, 100)),
        ]);
        if (!childExited()) {
            child.kill("SIGKILL");
            await Promise.race([
                once(child, "exit"),
                new Promise(resolve => setTimeout(resolve, 1_000)),
            ]);
        }
        if (!childExited()) {
            return false;
        }
        await rm(fixture, { recursive: true });
        return true;
    })();
    return cleanupPromise;
}

installSignalCleanup(cleanup, code => {
    writeFile(exitCodeFile, String(code)).then(() => process.exit(0));
});
await writeFile(readyFile, "ready");
setInterval(() => {}, 1_000);
