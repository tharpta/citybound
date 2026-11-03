import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const smokePath = new URL("./smoke-browser-compat.mjs", import.meta.url);
const smokeSource = await readFile(smokePath, "utf8");

function findWaitForFunctionArguments(source) {
    const calls = [];
    const pattern = /\.waitForFunction\s*\(/g;
    let match;

    while ((match = pattern.exec(source))) {
        const start = pattern.lastIndex;
        const args = [];
        let argumentStart = start;
        const delimiters = [")"];
        let quote;
        let escaped = false;

        for (let index = start; index < source.length; index += 1) {
            const character = source[index];
            const next = source[index + 1];

            if (quote) {
                if (escaped) {
                    escaped = false;
                } else if (character === "\\") {
                    escaped = true;
                } else if (character === quote) {
                    quote = undefined;
                }
                continue;
            }

            if (character === "'" || character === '"' || character === "`") {
                quote = character;
            } else if (character === "/" && next === "/") {
                const newline = source.indexOf("\n", index + 2);
                index = newline === -1 ? source.length : newline;
            } else if (character === "/" && next === "*") {
                const close = source.indexOf("*/", index + 2);
                index = close === -1 ? source.length : close + 1;
            } else if (character === "(") {
                delimiters.push(")");
            } else if (character === "[") {
                delimiters.push("]");
            } else if (character === "{") {
                delimiters.push("}");
            } else if (character === "," && delimiters.length === 1) {
                args.push(source.slice(argumentStart, index).trim());
                argumentStart = index + 1;
            } else if (character === delimiters.at(-1)) {
                delimiters.pop();
                if (delimiters.length === 0) {
                    const last = source.slice(argumentStart, index).trim();
                    if (last) {
                        args.push(last);
                    }
                    calls.push(args);
                    pattern.lastIndex = index + 1;
                    break;
                }
            }
        }
    }

    return calls;
}

test("every browser smoke wait uses the configured timeout options position", () => {
    const calls = findWaitForFunctionArguments(smokeSource);

    assert.ok(calls.length > 0, "expected browser smoke waitForFunction calls");
    for (const [index, args] of calls.entries()) {
        assert.equal(args.length, 3, `waitForFunction call ${index + 1} must pass predicate, arg, and options`);
        assert.match(args[2], /\btimeout\s*:/, `waitForFunction call ${index + 1} must set a timeout`);
        assert.match(args[2], /\bbrowserTimeoutMs\b/, `waitForFunction call ${index + 1} must use the configured timeout`);
    }
});

test("a deliberately absent condition rejects at a short configured timeout", async () => {
    const configuredTimeoutMs = 35;
    const waitForFunction = (predicate, arg, options = {}) => new Promise((resolve, reject) => {
        const timeoutMs = options.timeout ?? 30_000;
        const startedAt = Date.now();
        const poll = setInterval(async () => {
            try {
                if (await predicate(arg)) {
                    clearInterval(poll);
                    clearTimeout(timer);
                    resolve();
                }
            } catch (error) {
                clearInterval(poll);
                clearTimeout(timer);
                reject(error);
            }
        }, 1);
        const timer = setTimeout(() => {
            clearInterval(poll);
            reject(new Error(`Timeout ${timeoutMs}ms exceeded after ${Date.now() - startedAt}ms`));
        }, timeoutMs);
    });

    const startedAt = Date.now();
    await assert.rejects(
        waitForFunction(() => false, undefined, { timeout: configuredTimeoutMs }),
        new RegExp(`Timeout ${configuredTimeoutMs}ms exceeded`),
    );
    const elapsedMs = Date.now() - startedAt;

    assert.ok(elapsedMs >= configuredTimeoutMs - 5, `rejected too early after ${elapsedMs}ms`);
    assert.ok(elapsedMs < 500, `short timeout took too long (${elapsedMs}ms)`);
});
