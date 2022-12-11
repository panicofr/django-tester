export interface IProcessRunConfiguration {
    cwd?: string;
    environment?: { [key: string]: string | undefined };
    acceptedExitCodes?: readonly number[];
}

export interface IProcessExecution {
    pid: number;

    complete(): Promise<{ exitCode: number; output: string }>;

    cancel(): void;
}
