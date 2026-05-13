export class CheeseKitError extends Error {
  public readonly code: string;
  override readonly cause?: unknown;

  constructor(
    message: string,
    code: string,
    cause?: unknown
  ) {
    super(message);
    this.name = "CheeseKitError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class SendQueueError extends CheeseKitError {
  constructor(message: string, code = "SEND_QUEUE_ERROR", cause?: unknown) {
    super(message, code, cause);
    this.name = "SendQueueError";
  }
}

export class ToolRunnerError extends CheeseKitError {
  constructor(message: string, code = "TOOL_RUNNER_ERROR", cause?: unknown) {
    super(message, code, cause);
    this.name = "ToolRunnerError";
  }
}
