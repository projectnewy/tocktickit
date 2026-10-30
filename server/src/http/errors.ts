export class AppError extends Error {
  status: number;
  code?: string;
  // Extra safe fields merged into the error body, e.g. { currentVersion } on STALE_VERSION.
  extra?: Record<string, unknown>;

  constructor(status: number, message: string, code?: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid request") {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No requester selected") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, message);
  }
}

export class GoneError extends AppError {
  constructor(message = "Gone") {
    super(410, message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Payload too large") {
    super(413, message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = "Unsupported media type") {
    super(415, message);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Unprocessable request") {
    super(422, message);
  }
}
