/**
 * Validation Utilities
 * Các hàm helper để validate input
 */

import { BadRequestError } from '../errors/AppError.js';

/**
 * Validate UUID format
 * @param uuid - UUID string to validate
 * @returns true if valid UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate and normalize UUID
 * @param uuid - UUID string
 * @param fieldName - Field name for error message
 * @returns Normalized UUID
 * @throws BadRequestError if invalid
 */
export function validateUUID(uuid: string | undefined, fieldName: string): string {
  if (!uuid || typeof uuid !== 'string') {
    throw new BadRequestError(`${fieldName} là bắt buộc và phải là chuỗi`);
  }

  const trimmed = uuid.trim();
  if (trimmed.length === 0) {
    throw new BadRequestError(`${fieldName} không được rỗng`);
  }

  if (!isValidUUID(trimmed)) {
    throw new BadRequestError(`${fieldName} không đúng định dạng UUID`);
  }

  return trimmed;
}

/**
 * Validate positive integer
 * @param value - Value to validate
 * @param fieldName - Field name for error message
 * @param min - Minimum value (default: 1)
 * @returns Validated number
 * @throws BadRequestError if invalid
 */
export function validatePositiveInteger(
  value: number | undefined,
  fieldName: string,
  min: number = 1
): number {
  if (value === undefined || value === null) {
    return min;
  }

  const num = Number(value);
  if (isNaN(num) || !Number.isInteger(num) || num < min) {
    throw new BadRequestError(`${fieldName} phải là số nguyên dương >= ${min}`);
  }

  return num;
}

/**
 * Validate string is not empty
 * @param value - String to validate
 * @param fieldName - Field name for error message
 * @returns Trimmed string
 * @throws BadRequestError if invalid
 */
export function validateNonEmptyString(value: string | undefined, fieldName: string): string {
  if (!value || typeof value !== 'string') {
    throw new BadRequestError(`${fieldName} là bắt buộc`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BadRequestError(`${fieldName} không được rỗng`);
  }

  return trimmed;
}

