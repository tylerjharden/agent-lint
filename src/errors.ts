export class GateError extends Error {
  readonly exitCode = 2 as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GateError";
  }
}
