"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Image as ImageIcon,
  MessageSquare,
  Trash2,
  Handshake,
} from "lucide-react";
import { seedSampleImages, type SeedResult } from "@/lib/admin/seedSamples";
import {
  clearAllContent,
  seedDemoInquiries,
  seedDemoSponsors,
  type ClearAllOptions,
  type ClearAllResult,
  type InquirySeedResult,
  type SponsorSeedResult,
} from "@/lib/admin/seedDemo";
import {
  resetAndSeedKprint2026,
  type Kprint2026FinalSeedResult,
} from "@/lib/admin/seedKprint2026Final";
import { useEventFilter } from "@/lib/admin/useEventFilter";

type AnyResult =
  | { kind: "image"; data: SeedResult }
  | { kind: "inquiry"; data: InquirySeedResult }
  | { kind: "sponsor"; data: SponsorSeedResult }
  | { kind: "clear-all"; data: ClearAllResult }
  | { kind: "kprint-final"; data: Kprint2026FinalSeedResult };

export default function SeedPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<AnyResult[]>([]);
  const [purgeOpts, setPurgeOpts] = useState<ClearAllOptions>({
    categories: true,
    packages: true,
    inquiries: true,
    sponsors: true,
    events: false,
    importHistory: false,
    siteSettings: false,
  });
  const { eventId } = useEventFilter();

  const requireEvent = (label: string): string | null => {
    if (!eventId) {
      alert(`상단 셀렉터에서 행사를 먼저 선택해주세요. (${label} 시드는 선택된 행사에 적용됩니다)`);
      return null;
    }
    return eventId;
  };

  const run = async (
    label: string,
    fn: () => Promise<AnyResult>,
    confirmMsg?: string
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setRunning(label);
    try {
      const r = await fn();
      setResults((p) => [r, ...p]);
    } catch (e) {
      alert(`${label} 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <header>
        <h1 className="text-[22px] font-bold text-ink-900 leading-tight flex items-center gap-2">
          <Database className="w-5 h-5 text-brand-700" />
          샘플 데이터 채우기·초기화
        </h1>
        <p className="text-[13px] text-ink-700 mt-1">
          K-PRINT 2026 라인업으로 초기화하거나, 테스트용 샘플 데이터를 채워 넣습니다.
        </p>
      </header>

      {/* KPRINT 2026 완전 초기화 + 시드 — 가장 강조 (red) */}
      <div className="bg-red-50 border-2 border-red-300 rounded-card p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-btn bg-red-100 text-red-700 grid place-items-center shrink-0">
          <Trash2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-red-800">
            🔥 KPRINT 2026 으로 완전 초기화
          </div>
          <p className="text-[12px] text-red-700 mt-0.5 leading-relaxed">
            <strong>모든 카테고리·소분류·슬롯·패키지·문의·스폰서·사이트설정·행사·임포트이력 삭제</strong>
            한 다음, 확정된 KPRINT 2026 라인업으로 시드합니다.
            <br />
            카테고리 <strong>20종</strong> (오프라인 8 + 온라인 12) · 패키지{" "}
            <strong>4종</strong> (A to Z / 프라임 / 온사이트 / 세미나) + 행사 1개 + 기본 siteSettings.
            <br />
            <strong className="text-red-900">되돌릴 수 없습니다.</strong> 운영 데이터가 있으면 백업 먼저.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            run(
              "kprint-final",
              async () => ({
                kind: "kprint-final",
                data: await resetAndSeedKprint2026(),
              }),
              "정말로 모든 데이터를 삭제하고 KPRINT 2026 라인업으로 초기화할까요?\n\n이 작업은 되돌릴 수 없습니다."
            )
          }
          disabled={!!running}
          className="px-3.5 py-2 rounded-btn bg-red-700 text-white text-[12px] font-bold hover:bg-red-800 disabled:opacity-50 shrink-0 whitespace-nowrap"
        >
          {running === "kprint-final" ? "초기화 중…" : "완전 초기화 + 시드"}
        </button>
      </div>

      {/* 부수 시드 — 테스트용 샘플 데이터 (이미지·문의·스폰서). KPRINT 라인업과 별개로 데모 환경 구성용. */}
      <section>
        <h2 className="text-[14px] font-bold text-ink-900 mb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-ink-500" />
          테스트용 샘플 시드 (선택)
        </h2>
        <p className="text-[11.5px] text-ink-500 mb-3 leading-relaxed">
          위 라인업 시드를 돌린 후 추가로 채울 수 있는 보조 데이터. 운영 환경에선 보통 불필요.
        </p>
        <div className="space-y-3">
          <SeedCard
            icon={<ImageIcon className="w-4 h-4" />}
            title="카테고리 샘플 이미지"
            description="이미 임포트된 카테고리(코드 매칭)에 Unsplash 이미지·shortDesc·longDesc·heroMode 일괄 적용. isPublished=true 로 만듭니다."
            buttonLabel="이미지 시드"
            running={running === "image"}
            disabled={!!running}
            onClick={() =>
              run("image", async () => ({ kind: "image", data: await seedSampleImages() }))
            }
          />

          <SeedCard
            icon={<MessageSquare className="w-4 h-4" />}
            title="샘플 문의 (5건)"
            description="공개 사이트 문의 폼으로 들어온 것처럼 cart 항목과 함께 5건 생성 (신규 2 / 진행중 2 / 종료 1)."
            buttonLabel="문의 시드"
            running={running === "inquiry"}
            disabled={!!running}
            onClick={() => {
              const ev = requireEvent("문의");
              if (!ev) return;
              run("inquiry", async () => ({
                kind: "inquiry",
                data: await seedDemoInquiries(ev),
              }));
            }}
          />

          <SeedCard
            icon={<Handshake className="w-4 h-4" />}
            title="샘플 스폰서 (~17개)"
            description="샘플 스폰서 데이터 — 진행중·검토중·협찬 상태 다양하게. 활성 행사에 자동 연결."
            buttonLabel="스폰서 시드"
            running={running === "sponsor"}
            disabled={!!running}
            onClick={() =>
              run("sponsor", async () => ({
                kind: "sponsor",
                data: await seedDemoSponsors(),
              }))
            }
          />
        </div>
      </section>

      <hr className="border-ink-100" />

      {/* 위험 구역 — 전체 삭제 */}
      <section className="bg-red-50 border-2 border-red-300 rounded-card p-4">
        <h2 className="text-[15px] font-bold text-red-800 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          위험 구역 — 전체 콘텐츠 삭제
        </h2>
        <p className="text-[12px] text-red-700 leading-relaxed">
          체크한 컬렉션의 <strong>모든 도큐먼트</strong>를 일괄 삭제합니다. 데모/시드 여부 무관, 직접 입력한 데이터까지 모두 삭제되니 주의하세요. 이미지·도면 핀·잠금 등 일체 보존 안 됩니다. 되돌릴 수 없습니다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <PurgeCheckbox
            label="카테고리 + 소분류 + 슬롯"
            checked={purgeOpts.categories ?? false}
            onChange={(b) => setPurgeOpts((p) => ({ ...p, categories: b }))}
          />
          <PurgeCheckbox
            label="패키지"
            checked={purgeOpts.packages ?? false}
            onChange={(b) => setPurgeOpts((p) => ({ ...p, packages: b }))}
          />
          <PurgeCheckbox
            label="문의"
            checked={purgeOpts.inquiries ?? false}
            onChange={(b) => setPurgeOpts((p) => ({ ...p, inquiries: b }))}
          />
          <PurgeCheckbox
            label="스폰서"
            checked={purgeOpts.sponsors ?? false}
            onChange={(b) => setPurgeOpts((p) => ({ ...p, sponsors: b }))}
          />
          <PurgeCheckbox
            label="행사 (events)"
            checked={purgeOpts.events ?? false}
            onChange={(b) => setPurgeOpts((p) => ({ ...p, events: b }))}
          />
          <PurgeCheckbox
            label="임포트 이력"
            checked={purgeOpts.importHistory ?? false}
            onChange={(b) => setPurgeOpts((p) => ({ ...p, importHistory: b }))}
          />
          <PurgeCheckbox
            label="사이트 설정 (siteSettings)"
            checked={purgeOpts.siteSettings ?? false}
            onChange={(b) => setPurgeOpts((p) => ({ ...p, siteSettings: b }))}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const checked = Object.entries(purgeOpts)
              .filter(([, v]) => v)
              .map(([k]) => k);
            if (checked.length === 0) {
              alert("삭제할 컬렉션을 하나 이상 선택해주세요.");
              return;
            }
            run(
              "clear-all",
              async () => ({
                kind: "clear-all",
                data: await clearAllContent(purgeOpts),
              }),
              `다음 컬렉션의 모든 데이터를 삭제합니다:\n\n${checked.join(", ")}\n\n되돌릴 수 없습니다. 정말 진행할까요?`
            );
          }}
          disabled={!!running}
          className="mt-4 w-full px-4 py-2.5 rounded-btn bg-red-600 text-white text-[13px] font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          {running === "clear-all" ? "삭제 중…" : "선택한 컬렉션 전체 삭제"}
        </button>
      </section>

      {results.length > 0 && (
        <section>
          <h2 className="text-[15px] font-bold text-ink-900 mb-3">실행 결과</h2>
          <div className="space-y-2">
            {results.map((r, i) => (
              <ResultCard key={i} result={r} />
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] text-ink-500">
        💡 권장 순서: ① 엑셀 임포트 → ② 카테고리 이미지 시드 → ③ 패키지 → ④ 문의 → ⑤ 스폰서.
      </p>
    </div>
  );
}

function SeedCard({
  icon,
  title,
  description,
  buttonLabel,
  running,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  running: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="bg-white border border-ink-100 rounded-card p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-btn bg-brand-50 text-brand-700 grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold text-ink-900">{title}</div>
        <p className="text-[12px] text-ink-700 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="px-3.5 py-2 rounded-btn bg-ink-900 text-white text-[12px] font-semibold hover:bg-ink-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
      >
        {running ? "실행 중…" : buttonLabel}
      </button>
    </div>
  );
}

function ResultCard({ result }: { result: AnyResult }) {
  const cardClass = "bg-brand-50 border border-brand-100 rounded-card p-3 text-[12px]";
  if (result.kind === "image") {
    const r = result.data;
    return (
      <div className={cardClass}>
        <div className="font-bold text-brand-700 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          이미지 시드 — 처리 {r.processed.length} / 건너뜀 {r.skipped.length} / 실패 {r.errors.length}
        </div>
        {r.skipped.length > 0 && (
          <div className="text-ink-500 mt-1">
            건너뜀: {r.skipped.join(", ")}
          </div>
        )}
        {r.errors.length > 0 && (
          <div className="text-red-700 mt-1">
            실패: {r.errors.map((e) => `${e.code} (${e.reason})`).join("; ")}
          </div>
        )}
      </div>
    );
  }
  if (result.kind === "inquiry") {
    const r = result.data;
    return (
      <div className={cardClass}>
        <div className="font-bold text-brand-700 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          문의 시드 — 생성 {r.created.length} / 건너뜀 {r.skipped.length} / 실패 {r.errors.length}
        </div>
      </div>
    );
  }
  if (result.kind === "sponsor") {
    const r = result.data;
    return (
      <div className={cardClass}>
        <div className="font-bold text-brand-700 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          스폰서 시드 — 생성 {r.created.length} / 건너뜀 {r.skipped.length} / 실패 {r.errors.length}
        </div>
      </div>
    );
  }
  if (result.kind === "kprint-final") {
    const r = result.data;
    const totalDeleted = Object.values(r.cleared.deleted).reduce(
      (s, n) => s + n,
      0
    );
    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-card p-3 text-[12px]">
        <div className="font-bold text-red-700 flex items-center gap-1.5 mb-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          KPRINT 2026 완전 초기화 + 시드 완료
        </div>
        <div className="text-ink-700">
          <strong>삭제</strong> ({totalDeleted}건):{" "}
          {Object.entries(r.cleared.deleted)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ")}
        </div>
        <div className="text-ink-700 mt-1">
          <strong>생성</strong>: 행사 ✓ · siteSettings ✓ · 카테고리{" "}
          {r.created.categories} · 소분류 {r.created.subcategories} · 슬롯{" "}
          {r.created.slots} · 패키지 {r.created.packages} · 페르소나{" "}
          {r.created.personas}
        </div>
        {r.cleared.errors.length > 0 && (
          <div className="mt-1 text-red-800">
            삭제 실패:{" "}
            {r.cleared.errors
              .map((e) => `${e.collection} (${e.reason})`)
              .join("; ")}
          </div>
        )}
      </div>
    );
  }
  // clear-all
  const r = result.data;
  const total = Object.values(r.deleted).reduce((s, n) => s + n, 0);
  return (
    <div className="bg-red-50 border border-red-200 rounded-card p-3 text-[12px]">
      <div className="font-bold text-red-700 flex items-center gap-1.5">
        <Trash2 className="w-3.5 h-3.5" />
        전체 삭제 — 총 {total}건 처리
      </div>
      <ul className="mt-1 text-red-700">
        {Object.entries(r.deleted).map(([k, v]) => (
          <li key={k}>· {k}: {v}건</li>
        ))}
      </ul>
      {r.errors.length > 0 && (
        <div className="mt-1 text-red-800">
          실패: {r.errors.map((e) => `${e.collection} (${e.reason})`).join("; ")}
        </div>
      )}
    </div>
  );
}

function PurgeCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 rounded-btn bg-white border border-red-200 cursor-pointer hover:bg-red-100/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-red-600"
      />
      <span className="text-[12.5px] text-ink-900 font-semibold">{label}</span>
    </label>
  );
}
