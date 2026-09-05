/** أخطاء التطبيق الموحدة. الطبقة العليا تحولها إلى HTTP status أو رسالة واجهة. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "بيانات غير صالحة", details?: unknown) {
    super(message, "VALIDATION_ERROR", 422, details);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(id ? `${entity} ${id} غير موجود` : `${entity} غير موجود`, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "غير مصرح") {
    super(message, "FORBIDDEN", 403);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(entity: string, from: string, to: string) {
    super(`لا يمكن نقل ${entity} من ${from} إلى ${to}`, "INVALID_STATE_TRANSITION", 409);
  }
}

export class InsufficientStockError extends AppError {
  constructor(variantId: string, requested: number, available: number) {
    super("الكمية المطلوبة غير متوفرة", "INSUFFICIENT_STOCK", 409, { variantId, requested, available });
  }
}
