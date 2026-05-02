export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function truncateError(error: unknown, maxLength = 1000) {
  return errorMessage(error).slice(0, maxLength);
}
