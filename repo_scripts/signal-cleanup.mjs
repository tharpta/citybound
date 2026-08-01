const signalExitCodes = new Map([
    ["SIGINT", 130],
    ["SIGTERM", 143],
]);

export function installSignalCleanup(cleanup, exit = code => process.exit(code)) {
    let handlingSignal = false;
    const handlers = new Map();

    for (const [signal, exitCode] of signalExitCodes) {
        const handler = () => {
            if (handlingSignal) {
                exit(1);
                return;
            }
            handlingSignal = true;
            Promise.resolve()
                .then(cleanup)
                .then(succeeded => exit(succeeded === false ? 1 : exitCode))
                .catch(error => {
                    console.error(`Signal cleanup failed: ${error.message}`);
                    exit(1);
                });
        };
        handlers.set(signal, handler);
        process.on(signal, handler);
    }

    return () => {
        for (const [signal, handler] of handlers) {
            process.off(signal, handler);
        }
    };
}
