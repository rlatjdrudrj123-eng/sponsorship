"use client";

import Link from "next/link";
import { ArrowLeft, Brain, Scale, MessageCircle } from "lucide-react";
import {
  QUESTIONS,
  STAGES,
  SCORING_WEIGHTS,
} from "@/components/public/PersonaAiChat";

/**
 * 스폰서십 진단 로직 뷰어 — 어드민용.
 *
 * PersonaAiChat (룰 기반 챗봇) 의 질문·가중치를 그대로 노출합니다.
 * 현재 K-PRINT 기준 6단계 진단. 분야(segment) 가 lead question.
 *
 * 코드 단일 출처: components/public/PersonaAiChat.tsx 의 QUESTIONS / SCORING_WEIGHTS
 * → 여기에 표시되는 값은 곧 사용자에게 노출되는 값과 동일.
 */
export default function DiagnosisLogicPage() {
  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/settings"
          className="text-[12px] text-ink-500 hover:text-ink-900 flex items-center gap-1 mb-1"
        >
          <ArrowLeft className="w-3 h-3" />
          사이트 설정
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-500" />
              스폰서십 진단 로직
            </h1>
            <p className="text-[13px] text-ink-700 mt-1 max-w-2xl">
              참가업체에게 노출되는 「대화로 추천 받기」 챗봇의 질문·가중치를
              그대로 보여드립니다. 현재 K-PRINT 기준 <strong>6단계</strong>,
              분야(segment) 가 lead question.
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-btn bg-brand-50 border border-brand-100 text-[11.5px] text-brand-700 font-num font-bold">
            코드 단일 출처: PersonaAiChat.tsx
          </div>
        </div>
      </header>

      {/* 질문 6단계 */}
      <section className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <header className="px-5 py-4 border-b border-ink-100 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-ink-700" />
          <h2 className="text-[14px] font-bold text-ink-900">
            질문 흐름 ({STAGES.length}단계)
          </h2>
        </header>
        <ol className="divide-y divide-ink-100">
          {STAGES.map((stage, i) => {
            const q = QUESTIONS[stage];
            return (
              <li key={stage} className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-ink-900 text-white grid place-items-center text-[12px] font-bold shrink-0 font-num">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-num text-[10.5px] uppercase tracking-wider font-bold text-ink-500">
                        {stage}
                      </span>
                      {i === 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-brand-500 text-white tracking-wider">
                          LEAD
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-semibold text-ink-900 leading-snug">
                      “{q.intro}”
                    </p>
                    {q.why && (
                      <p className="text-[12px] text-ink-500 leading-relaxed mt-1.5 italic">
                        ↳ {q.why}
                      </p>
                    )}
                    {q.chips && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {q.chips.map((chip) => (
                          <div
                            key={chip.value}
                            className="px-2.5 py-1 rounded-pill border border-ink-100 bg-ink-50 text-[11.5px] text-ink-700"
                            title={chip.hint}
                          >
                            <span className="font-semibold text-ink-900">
                              {chip.label}
                            </span>
                            <span className="ml-1.5 font-mono text-[10px] text-ink-400">
                              {chip.value}
                            </span>
                            {chip.hint && (
                              <div className="text-[10.5px] text-ink-500 mt-0.5 leading-tight">
                                {chip.hint}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 스코어링 가중치 */}
      <section className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <header className="px-5 py-4 border-b border-ink-100 flex items-center gap-2">
          <Scale className="w-4 h-4 text-ink-700" />
          <h2 className="text-[14px] font-bold text-ink-900">
            페르소나 매칭 가중치
          </h2>
        </header>
        <div className="p-5 space-y-3">
          <p className="text-[12.5px] text-ink-700 leading-relaxed">
            응답을 모두 받은 후, 활성 페르소나 각각에 대해 아래 항목으로 점수를
            합산하고 가장 높은 페르소나를 추천합니다. 점수가 같으면 첫 번째
            활성 페르소나가 선택됩니다.
          </p>
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="border-b-2 border-ink-200">
                <th className="text-left py-2 px-2 font-semibold text-ink-700">
                  요인
                </th>
                <th className="text-right py-2 px-2 font-num font-bold text-ink-700">
                  가중치
                </th>
                <th className="text-left py-2 px-2 font-semibold text-ink-700">
                  적용 조건
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              <Row
                weight={SCORING_WEIGHTS.segmentMatch}
                label="분야(segment) 일치"
                cond="페르소나 targetTags / id / title 에 분야 키워드 포함 시"
                emphasis
              />
              <Row
                weight={SCORING_WEIGHTS.budgetInRange}
                label="예산 범위 일치"
                cond="페르소나 budgetMin ≤ 답변 예산 ≤ budgetMax"
              />
              <Row
                weight={SCORING_WEIGHTS.experienceFirst}
                label="신규 참가 보너스"
                cond='experience === "first" + 페르소나 id 가 "first-time" 으로 끝나거나 title 에 "처음/신규"'
              />
              <Row
                weight={SCORING_WEIGHTS.experienceRegular}
                label="정기 참가 보너스"
                cond='experience === "regular" + 페르소나 packageTier === "signature" 등'
              />
              <Row
                weight={SCORING_WEIGHTS.companySizeLarge}
                label="대기업 + 시그니처"
                cond='companySize === "large" + packageTier === "signature"'
              />
              <Row
                weight={SCORING_WEIGHTS.companySizeSolo}
                label="1인 + 단품 가중"
                cond='companySize === "solo" + title 에 "진입/단품" 또는 budgetMax < 1천만원'
              />
              <Row
                weight={SCORING_WEIGHTS.goalMatch}
                label="목표(purpose) 일치"
                cond="페르소나 purposes 배열에 답변 목표 포함"
              />
              <Row
                weight={SCORING_WEIGHTS.locationMatch}
                label="위치 약가중"
                cond="페르소나 title 에 위치 키워드 포함 (any 가 아닐 때)"
              />
              <Row
                weight={-1}
                label="예산 평균 거리 패널티"
                cond={`Math.abs(답변 예산 - mid) × ${SCORING_WEIGHTS.budgetDistancePenalty} 만큼 감점`}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* 분야 → 채널 매칭 보너스 (computeCombo) */}
      <section className="bg-white border border-ink-100 rounded-card overflow-hidden">
        <header className="px-5 py-4 border-b border-ink-100">
          <h2 className="text-[14px] font-bold text-ink-900">
            분야 × 채널 매칭 보너스 (콤보 추천 단계)
          </h2>
          <p className="text-[12px] text-ink-500 mt-1">
            페르소나가 정해진 후, 그 안에서 어떤 카테고리/구좌를 콤보로 묶을지
            결정할 때 사용되는 보너스.
          </p>
        </header>
        <div className="p-5 grid md:grid-cols-2 gap-3 text-[12.5px]">
          <ComboRow
            seg="🖨 일반 인쇄 (offset)"
            channel="—"
            note="기본 채널 — 별도 보너스 없음"
          />
          <ComboRow
            seg="💻 디지털 인쇄·POD"
            channel="digital_banner · mailing"
            note="+30점 (온라인 적합)"
          />
          <ComboRow
            seg="📦 패키징·박스"
            channel="print_page · floor_plan"
            note="+25점 (도면·샘플북)"
          />
          <ComboRow
            seg="🏷 라벨·스티커"
            channel="—"
            note="별도 보너스 없음 — 시그니처 패키지 추천"
          />
          <ComboRow
            seg="🪧 사인·디스플레이"
            channel="xpace (전광판)"
            note="+30점"
          />
          <ComboRow
            seg="⚙ 잉크·소재·기자재"
            channel="quantity (목걸이) · media"
            note="+20점"
          />
        </div>
      </section>

      <section className="bg-ink-50 border border-ink-100 rounded-card p-5">
        <h3 className="text-[13px] font-bold text-ink-900 mb-2">코드 위치</h3>
        <ul className="text-[12.5px] text-ink-700 space-y-1 font-mono leading-relaxed">
          <li>
            ·{" "}
            <code className="bg-white px-1.5 py-0.5 rounded border border-ink-100">
              components/public/PersonaAiChat.tsx
            </code>
            <span className="text-ink-500 font-sans ml-2">
              — QUESTIONS, STAGES, SCORING_WEIGHTS, findBestPersona, computeCombo
            </span>
          </li>
          <li>
            ·{" "}
            <code className="bg-white px-1.5 py-0.5 rounded border border-ink-100">
              app/(public)/[eventSlug]/sponsorships/page.tsx
            </code>
            <span className="text-ink-500 font-sans ml-2">
              — 인라인 채팅 진입부 (첫 분야 칩 노출)
            </span>
          </li>
          <li>
            ·{" "}
            <code className="bg-white px-1.5 py-0.5 rounded border border-ink-100">
              admin/classification (페르소나 관리)
            </code>
            <span className="text-ink-500 font-sans ml-2">
              — 페르소나 추가·수정 (purposes, targetTags, budgetMin/Max,
              packageTier 등)
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Row({
  weight,
  label,
  cond,
  emphasis,
}: {
  weight: number;
  label: string;
  cond: string;
  emphasis?: boolean;
}) {
  return (
    <tr className={emphasis ? "bg-brand-50/40" : ""}>
      <td className="py-2 px-2 font-semibold text-ink-900">{label}</td>
      <td
        className={
          "text-right py-2 px-2 font-num font-bold " +
          (weight < 0 ? "text-red-600" : emphasis ? "text-brand-500" : "text-ink-900")
        }
      >
        {weight < 0 ? "−" : "+"}
        {Math.abs(weight)}
      </td>
      <td className="py-2 px-2 text-ink-500 font-mono text-[11px] leading-snug">
        {cond}
      </td>
    </tr>
  );
}

function ComboRow({
  seg,
  channel,
  note,
}: {
  seg: string;
  channel: string;
  note: string;
}) {
  return (
    <div className="border border-ink-100 rounded p-3 bg-white">
      <div className="font-semibold text-ink-900 mb-1">{seg}</div>
      <div className="text-ink-700">{channel}</div>
      <div className="text-[11.5px] text-brand-500 font-num mt-1">{note}</div>
    </div>
  );
}
