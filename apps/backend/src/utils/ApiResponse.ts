export class ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;

  constructor(statusCode: number = 200, data: T, message: string = "success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = true;
  }
}
