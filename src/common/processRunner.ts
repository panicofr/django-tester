import { ChildProcess, spawn } from "child_process";
import * as iconv from "iconv-lite";
import { Uri } from "vscode";
import { DjangoTestingContext } from "../testing/context";
import { IProcessExecution, IProcessRunConfiguration } from "./types";

class CommandProcessExecution implements IProcessExecution {
    public readonly pid: number;

    private readonly commandProcess: ChildProcess;
    private readonly acceptedExitCodes: readonly number[];

    constructor(
        command: string,
        args?: string[],
        configuration?: IProcessRunConfiguration
    ) {
        this.commandProcess = spawn(command, args, {
            cwd: configuration?.cwd,
            env: {
                ...process.env,
                ...configuration?.environment,
            },
        });
        this.pid = this.commandProcess.pid || -1;
        this.acceptedExitCodes = configuration?.acceptedExitCodes || [0];
    }

    public async complete(): Promise<{ exitCode: number; output: string }> {
        return new Promise<{ exitCode: number; output: string }>((resolve, reject) => {
            const stdoutBuffer: Buffer[] = [];
            const stderrBuffer: Buffer[] = [];
            this.commandProcess.stdout!.on("data", (chunk) => stdoutBuffer.push(chunk));
            this.commandProcess.stderr!.on("data", (chunk) => stderrBuffer.push(chunk));

            this.commandProcess.once("close", (exitCode) => {
                if (
                    this.exitedWithUnexpectedExitCode(exitCode) &&
                    !this.commandProcess.killed
                ) {
                    reject(
                        new Error(
                            `Process exited with code ${exitCode}: ${decode(
                                stderrBuffer
                            )}`
                        )
                    );
                    return;
                }

                const output = decode(stdoutBuffer);
                if (!output) {
                    if (stdoutBuffer.length > 0) {
                        reject(new Error("Can not decode output from the process"));
                    }
                }
                resolve({ exitCode: exitCode || 0, output });
            });

            this.commandProcess.once("error", (error) => {
                reject(new Error(`Error occurred during process execution: ${error}`));
            });
        });
    }

    public cancel(): void {
        this.commandProcess.kill("SIGINT");
    }

    private exitedWithUnexpectedExitCode(exitCode: number | null): boolean {
        return exitCode !== null && this.acceptedExitCodes.indexOf(exitCode) < 0;
    }
}

function decode(buffers: Buffer[]) {
    return iconv.decode(Buffer.concat(buffers), "utf8");
}

export function executePythonProcess(
    command: string,
    args: string[] = []
): IProcessExecution {
    const commandPath = Uri.joinPath(
        DjangoTestingContext.djangoExtensionUri,
        "python_files",
        command
    );
    const fullArgs: string[] = [commandPath.fsPath].concat(args);
    return new CommandProcessExecution(
        DjangoTestingContext.interpreterPath.fsPath,
        fullArgs,
        DjangoTestingContext.env
    );
}
