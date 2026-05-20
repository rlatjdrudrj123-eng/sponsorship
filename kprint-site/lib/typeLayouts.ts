import type { CategoryType, SpecField, TypeLayout } from "./types";

/**
 * 카테고리 유형별 기본 슬라이드 레이아웃.
 * 어드민이 /admin/settings/type-layouts 에서 override 하지 않으면 이 값을 사용.
 */
export const DEFAULT_TYPE_LAYOUTS: Record<CategoryType, TypeLayout> = {
  floor_plan: {
    specFields: ["location", "size", "fileFormat", "deadline", "detail"],
  },
  quantity: {
    specFields: ["size", "fileFormat", "deadline", "detail"],
  },
  media: {
    specFields: ["video", "size", "fileFormat", "deadline", "detail"],
  },
  digital_banner: {
    specFields: ["size", "fileFormat", "deadline", "detail"],
  },
  mailing: {
    specFields: ["mailing", "size", "fileFormat", "deadline", "detail"],
  },
  print_page: {
    specFields: ["size", "fileFormat", "deadline", "detail"],
  },
  content: {
    specFields: ["content", "deadline", "detail"],
  },
  xpace: {
    specFields: ["location", "video", "size", "fileFormat", "deadline", "detail"],
  },
  package: {
    specFields: ["detail", "slots"],
  },
};

export function getTypeLayout(
  type: CategoryType,
  override?: Partial<Record<CategoryType, TypeLayout>>
): TypeLayout {
  return override?.[type] ?? DEFAULT_TYPE_LAYOUTS[type];
}

/** 스펙 필드 라벨 (어드민 + 공개 사이트 공용) */
export const SPEC_FIELD_LABEL: Record<SpecField, string> = {
  location: "게재 위치",
  size: "규격",
  fileFormat: "파일 형식",
  deadline: "제출 마감",
  detail: "세부사항",
  slots: "구좌",
  video: "영상 스펙",
  mailing: "발송 스펙",
  content: "콘텐츠 스펙",
};

export const SPEC_FIELD_HINT: Record<SpecField, string> = {
  location: "소분류 이름들을 콤마로 이은 위치 목록 (예: A1 출입구, B홀, C홀)",
  size: "Category.size 필드",
  fileFormat: "Category.fileFormat 필드",
  deadline: "Category.deadline 필드",
  detail: "소분류별 슬롯 수 (예: A1 출입구 5구좌, B홀 2구좌…)",
  slots: "총 잔여/총 구좌 수",
  video: "Category.videoSpec — 길이·해상도·송출횟수",
  mailing: "Category.mailingSpec — 발송 대상·발송일",
  content: "Category.contentSpec — 채널·포맷",
};

/** 사용 가능한 모든 필드 목록 (UI 토글용) */
export const ALL_SPEC_FIELDS: SpecField[] = [
  "location",
  "size",
  "fileFormat",
  "deadline",
  "detail",
  "slots",
  "video",
  "mailing",
  "content",
];
