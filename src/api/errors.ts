export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const validationError = (
  message: string,
  fields?: Record<string, string>,
) => new ApiError(422, "VALIDATION_ERROR", message, fields);

export const notFound = (message: string) =>
  new ApiError(404, "NOT_FOUND", message);
