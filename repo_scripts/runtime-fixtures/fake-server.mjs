#!/usr/bin/env node

import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const bindIndex = process.argv.indexOf("--bind");
const bindSimulationIndex = process.argv.indexOf("--bind-sim");
if (bindIndex < 0 || bindSimulationIndex < 0) {
    process.exit(2);
}

const [host, portText] = process.argv[bindIndex + 1].split(":");
const simulationPort = process.argv[bindSimulationIndex + 1].split(":").at(-1);
if (process.env.CITYBOUND_FAKE_PID_FILE) {
    writeFileSync(process.env.CITYBOUND_FAKE_PID_FILE, String(process.pid));
}
const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<script>simulationPort: ${simulationPort}</script>`);
});

process.on("SIGINT", () => {});
process.on("SIGTERM", () => {});
server.listen(Number(portText), host);
if (process.env.CITYBOUND_FAKE_EXIT_AFTER_MS) {
    setTimeout(
        () => server.close(() => process.exit(0)),
        Number(process.env.CITYBOUND_FAKE_EXIT_AFTER_MS),
    );
}
