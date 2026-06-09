"use client";

/**
 * 1분 진단 어드민 안내 페이지 (v3).
 *
 * v2 의 매트릭스 편집기는 폐기. v3 는 카테고리별 데이터 (goalAffinity,
 * synergyTargets, recommendBoost) 로 작동하므로 어드민 편집 진입점은
 * /admin/categories/[id] 의 「1분 진단 매칭」 섹션.
 */
import Link from "next/link";
import { ArrowLeft, Brain, ArrowRight } from "lucide-react";

export default function DiagnosisSettingsPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Link
        href="/admin/settings"
        className="text-[12px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        설정으로 돌아가기
      </Link>

      <header className="mb-6">
        <h1 className="text-[24px] font-bold text-ink-900 flex items-center gap-2">
          <Brain className="w-5 h-5 text-brand-500" />
          1분 맞춤 진단
        </h1>
        <p className="text-[13px] text-ink-700 mt-2 leading-relaxed">
          현재 진단은 카테고리별 데이터(목표 친화도·시너지·추천 가중) 로 작동합니다.
          이전 v2 의 매트릭스 편집기는 폐기됐습니다.
        </p>
      </header>

      <section className="bg-white border border-ink-100 rounded-card p-5 space-y-3">
        <div className="text-[13px] font-bold text-ink-900">
          진단 결과를 어디서 조정하나요?
        </div>
        <ol className="text-[12.5px] text-ink-700 leading-relaxed space-y-2 list-decimal pl-5">
          <li>
            <Link
              href="/admin/categories"
              className="text-brand-700 font-semibold hover:underline"
            >
              /admin/categories
            </Link>{" "}
            에서 카테고리 하나를 엽니다.
          </li>
          <li>
            「참가업체 시점」 섹션의{" "}
            <strong>「1분 진단 매칭」</strong> 영역으로 이동합니다.
          </li>
          <li>
            목표 친화도(신제품 홍보 / 현장 방문객 유도 / 브랜드 확산) 각 0~3 점,
            시너지 페어, 추천 가중(boost) 을 조정합니다.
          </li>
          <li>
            카트 자동 추가가 정상 작동하도록 카테고리에 가용 슬롯(status =
            available) 이 1개 이상 있어야 진단에 노출됩니다.
          </li>
        </ol>
        <div className="pt-3 border-t border-ink-100">
          <Link
            href="/admin/categories"
            className="inline-flex items-center gap-2 text-[12.5px] font-bold text-brand-700 hover:text-brand-900"
          >
            카테고리 편집으로 이동
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      <section className="mt-6 bg-amber-50 border border-amber-200 rounded-card p-4 text-[11.5px] text-amber-800 leading-relaxed">
        ⓘ 옛 v2 매트릭스 데이터 (siteSettings.diagnosisV2Config) 는 더 이상
        사용되지 않습니다. Firestore 에 남아있어도 진단에 영향 없음.
      </section>
    </div>
  );
}
