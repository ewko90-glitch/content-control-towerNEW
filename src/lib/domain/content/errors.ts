export type ContentErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INSUFFICIENT_AI_CREDITS";

export class ContentDomainError extends Error {
  readonly code: ContentErrorCode;
  readonly status: number;

  constructor(code: ContentErrorCode, message: string, status: number) {
    super(message);
    this.name = "ContentDomainError";
    this.code = code;
    this.status = status;
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ContentDomainError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "Wystąpił nieoczekiwany błąd serwera.",
      code: "INTERNAL_ERROR",
    },
  };
}