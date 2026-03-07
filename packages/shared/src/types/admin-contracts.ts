/**
 * 관리자/운영 전용 API 계약.
 * 사용자 surface와 분리해 import 위치만으로도 의도를 드러낸다.
 */

export interface AaValidationResponse {
  exp_id: string;
  control_count: number;
  treatment_count: number;
  balance_ratio: number;
  is_balanced: boolean;
}

export interface ReportBatchResponse {
  message: string;
  processed_users?: number;
  generated_reports?: number;
  failed_users?: number;
}
