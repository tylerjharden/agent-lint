export const EXIT_PASS = 0 as const;
export const EXIT_FAIL = 1 as const;
export const EXIT_ERROR = 2 as const;

export type ExitCode = typeof EXIT_PASS | typeof EXIT_FAIL | typeof EXIT_ERROR;
