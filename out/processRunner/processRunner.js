"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcess = void 0;
const child_process_1 = require("child_process");
const iconv = require("iconv-lite");
class CommandProcessExecution {
    constructor(command, args, configuration) {
        this.commandProcess = (0, child_process_1.spawn)(command, args, {
            cwd: configuration?.cwd,
            env: {
                ...process.env,
                ...configuration?.environment,
            },
        });
        this.pid = this.commandProcess.pid || -1;
        this.acceptedExitCodes = configuration?.acceptedExitCodes || [0];
    }
    async complete() {
        return new Promise((resolve, reject) => {
            const stdoutBuffer = [];
            const stderrBuffer = [];
            this.commandProcess.stdout.on('data', chunk => stdoutBuffer.push(chunk));
            this.commandProcess.stderr.on('data', chunk => stderrBuffer.push(chunk));
            this.commandProcess.once('close', exitCode => {
                if (this.exitedWithUnexpectedExitCode(exitCode) && !this.commandProcess.killed) {
                    reject(new Error(`Process exited with code ${exitCode}: ${decode(stderrBuffer)}`));
                    return;
                }
                const output = decode(stdoutBuffer);
                if (!output) {
                    if (stdoutBuffer.length > 0) {
                        reject(new Error('Can not decode output from the process'));
                    }
                }
                resolve({ exitCode: exitCode || 0, output });
            });
            this.commandProcess.once('error', error => {
                reject(new Error(`Error occurred during process execution: ${error}`));
            });
        });
    }
    cancel() {
        this.commandProcess.kill('SIGINT');
    }
    exitedWithUnexpectedExitCode(exitCode) {
        return exitCode !== null && this.acceptedExitCodes.indexOf(exitCode) < 0;
    }
}
function runProcess(command, args, configuration) {
    return new CommandProcessExecution(command, args, configuration);
}
exports.runProcess = runProcess;
function decode(buffers) {
    return iconv.decode(Buffer.concat(buffers), 'utf8');
}
//# sourceMappingURL=processRunner.js.map