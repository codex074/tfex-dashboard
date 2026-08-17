/**
 * Consistent API error format (AGENTS.md §67).
 *
 * Backend error codes are language-neutral. The frontend maps codes to
 * translated, user-friendly messages.
 */

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE_TRANSACTION"
  | "TRANSACTION_ALREADY_ASSIGNED"
  | "INVALID_TRADE_ASSIGNMENT"
  | "UNPROCESSABLE_ENTITY"
  | "INTERNAL_ERROR"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED";

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;

  constructor(statusCode: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }

  toPayload(): { error: { code: ApiErrorCode; message: string } } {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

export const errors = {
  notFound: (what: string) =>
    new ApiError(404, "NOT_FOUND", `${what} not found`),
  badRequest: (message: string) =>
    new ApiError(400, "BAD_REQUEST", message),
  validation: (message: string) =>
    new ApiError(400, "VALIDATION_ERROR", message),
  conflict: (message: string) =>
    new ApiError(409, "CONFLICT", message),
  duplicateTransaction: (message = "Transaction already exists") =>
    new ApiError(409, "DUPLICATE_TRANSACTION", message),
  transactionAlreadyAssigned: () =>
    new ApiError(
      409,
      "TRANSACTION_ALREADY_ASSIGNED",
      "Transaction is already assigned to a trade",
    ),
  invalidTradeAssignment: (message: string) =>
    new ApiError(422, "INVALID_TRADE_ASSIGNMENT", message),
  unsupportedFileType: (message = "Unsupported file type") =>
    new ApiError(415, "UNSUPPORTED_FILE_TYPE", message),
  fileTooLarge: (message = "File too large") =>
    new ApiError(413, "FILE_TOO_LARGE", message),
  unauthorized: (message = "Authentication required") =>
    new ApiError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Insufficient permissions") =>
    new ApiError(403, "FORBIDDEN", message),
  rateLimited: (message = "Too many requests, please try again later") =>
    new ApiError(429, "RATE_LIMITED", message),
  internal: (message = "Internal server error") =>
    new ApiError(500, "INTERNAL_ERROR", message),
};
