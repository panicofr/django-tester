export function getErrorMessage(maybeError: unknown): string {
    return maybeError instanceof Error ? maybeError.message : "Unknown error";
}
