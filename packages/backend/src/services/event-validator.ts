/**
 * ReviewEvent 서버측 스키마 검증기
 * ajv (JSON Schema Draft 2020-12) 기반으로 수신 이벤트를 검증한다.
 */

import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

const schema = JSON.parse(
  readFileSync(
    join(__dirname, '../../../shared/schemas/review-event.schema.json'),
    'utf-8'
  )
);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(schema);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * ReviewEvent 단건 검증
 */
export function validateReviewEvent(data: unknown): ValidationResult {
  const valid = validate(data) as boolean;
  const errors = valid
    ? []
    : (validate.errors ?? []).map(
        (e) => `${e.instancePath || '(root)'} ${e.message}`
      );
  return { valid, errors };
}

/**
 * ReviewEvent 배열 검증 (배치 ingest용)
 * 검증 실패 항목은 rejectedEvents로 분리한다.
 */
export function validateReviewEventBatch(data: unknown[]): {
  accepted: unknown[];
  rejected: { index: number; errors: string[] }[];
} {
  const accepted: unknown[] = [];
  const rejected: { index: number; errors: string[] }[] = [];

  data.forEach((item, index) => {
    const result = validateReviewEvent(item);
    if (result.valid) {
      accepted.push(item);
    } else {
      rejected.push({ index, errors: result.errors });
    }
  });

  return { accepted, rejected };
}
