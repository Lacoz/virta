export class LambdaTimeoutError extends Error {
  constructor(message: string = "Lambda execution approaching timeout") {
    super(message);
    this.name = "LambdaTimeoutError";
  }
}

export class CheckpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckpointError";
  }
}

