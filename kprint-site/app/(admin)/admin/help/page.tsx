"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { BOOTSTRAP_ADMIN_EMAILS } from "@/lib/firebase/config";

/**
 * 사용 안내 — 처음 쓰는 담당자(옆팀 포함)용 한 장 요약. 상단 도움말(?) 버튼에서 연결.
 */
type Step = { title: string; items: React.ReactNode[] };

const L = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-brand-700 font-semibold hover:underline">
    {children}
  </Link>
);

const STEPS: Step[] = [
  {
    title: "시작하기",
    items: [
      <>로그인 화면 [사용 신청] → 회사 메일 인증 → 관리자 승인·담당 전시회 배정</>,
      <>상단 오른쪽에서 작업할 전시회 선택 — 배정된 전시회만 보이고 수정 가능</>,
      <>
        승인·배정 요청: 관리자 {BOOTSTRAP_ADMIN_EMAILS.join(", ")}
      </>,
    ],
  },
  {
    title: "새 전시회 만들기 (관리자)",
    items: [
      <>
        <L href="/admin/events">행사 관리</L> → [새 행사] → 시작 방법 선택
      </>,
      <>빈 행사로 시작 / 기존 행사 복사해서 시작(매체·구좌·패키지·설정 복사, 구좌는 모두 판매 중으로)</>,
      <>복사 후 표시되는 ‘공개 전에 확인할 것’ 목록대로 일정·장소·신청 주소 교체</>,
    ],
  },
  {
    title: "스폰서십 매체 등록",
    items: [
      <>
        <L href="/admin/import">엑셀 일괄 등록</L>: 양식 내려받기 → 작성 → 업로드. 다시 올려도 구좌·스폰서 연결·매진은
        유지
      </>,
      <>
        한두 개는 <L href="/admin/categories">스폰서십 매체</L> → [새 매체]에서 직접
      </>,
      <>
        추천(1분 진단·함께 보면 좋은) 연결: <L href="/admin/classification">매체 분류</L>
      </>,
    ],
  },
  {
    title: "사이트 꾸미기",
    items: [
      <>
        <L href="/admin/settings">사이트 설정</L>: 기본 정보(일정·장소·연락처) · 추가 혜택 · 유형별 표시 · 1분 진단 ·
        참가 상황·태그
      </>,
      <>
        <L href="/admin/settings/landing">메인 페이지 디자인</L>: 다른 행사 메인 복사 후 문구·이미지 교체 가능
      </>,
      <>
        <L href="/admin/settings/quote">견적서 설정</L>: 사무국 정보·계좌·행사 안내 문구 (저장해야 견적서 출력 가능)
      </>,
    ],
  },
  {
    title: "영업 흐름",
    items: [
      <>
        <L href="/admin/inquiries">문의</L> 접수 — 고객에게 접수번호 표시, 접수번호로 검색 가능
      </>,
      <>문의 상세 → [스폰서로 전환] → 구좌 확보(저장 시 판매 처리)</>,
      <>단독 패키지(A to Z 등)는 저장할 때 매진 처리 여부 확인</>,
      <>문의·스폰서 상세 → [견적서 추출]</>,
    ],
  },
  {
    title: "확인·기록",
    items: [
      <>
        <L href="/admin/slots">판매 현황</L>: 매체별 판매·예약·남은 구좌, 매진 패키지
      </>,
      <>
        <L href="/admin/history">변경 이력</L>: 누가 언제 무엇을 바꿨는지 (각 상세 화면 하단에도 표시)
      </>,
    ],
  },
  {
    title: "공개 전 확인",
    items: [
      <>사이트 설정의 일정·장소·연락처, ‘온라인 신청’ 바로가기 주소</>,
      <>견적서 설정의 행사 문구·사업자번호(120-81-81311)</>,
      <>매체별 공개 여부·가격·마감일, 전체 PDF</>,
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-5 max-w-3xl">
      <header>
        <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-brand-700" />
          사용 안내
        </h1>
        <p className="text-[13px] text-ink-700 mt-1">처음 쓰는 담당자용 요약입니다.</p>
      </header>

      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-white border border-ink-100 rounded-card p-4">
            <h2 className="text-[14px] font-bold text-ink-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-ink-900 text-white text-[11px] grid place-items-center font-mono">
                {i + 1}
              </span>
              {s.title}
            </h2>
            <ul className="mt-2 space-y-1.5 text-[13px] text-ink-700 list-disc pl-9 break-keep leading-relaxed">
              {s.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
