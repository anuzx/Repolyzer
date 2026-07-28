export class ApiError extends Error {
  statusCode: number;
  success: boolean;

  constructor(statusCode: number = 400, message: string = "Error") {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.success = false;
  }
}
