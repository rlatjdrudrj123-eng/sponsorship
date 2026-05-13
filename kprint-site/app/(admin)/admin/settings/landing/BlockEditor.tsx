"use client";

import { Plus, Trash2 } from "lucide-react";
import type { LandingBlock } from "@/lib/types";
import { BLOCK_TYPE_META } from "@/components/public/landing/defaults";

/**
 * 선택된 블록의 인라인 편집 폼. type 별로 적절한 필드 노출.
 */
export function BlockEditor({
  block,
  onChange,
  onRemove,
  indexLabel,
}: {
  block: LandingBlock;
  onChange: (next: LandingBlock) => void;
  onRemove: () => void;
  indexLabel: string;
}) {
  const meta = BLOCK_TYPE_META[block.type];

  return (
    <div className="bg-white border border-ink-100 rounded-card overflow-hidden">
      <header className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-ink-500 font-mono">
            {indexLabel}
          </div>
          <h2 className="text-[15px] font-bold text-ink-900 mt-0.5">
            {meta.label}
          </h2>
          <p className="text-[11.5px] text-ink-500 mt-0.5">{meta.desc}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-btn text-ink-500 hover:text-red-700 hover:bg-red-50"
          title="블록 삭제"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </header>

      <div className="px-5 py-5">
        {block.type === "cover" && (
          <Fields>
            <Field label="상단 라벨 (eyebrow)" hint="대문자, 짧게. 예: Sponsorship">
              <input
                className={inputCls()}
                value={block.data.eyebrow ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, eyebrow: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="제목 (행사명)" required>
              <input
                className={inputCls()}
                value={block.data.title ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, title: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="부제 (일정 · 장소)">
              <input
                className={inputCls()}
                value={block.data.subtitle ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, subtitle: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="배경 이미지 URL" hint="비우면 빨강 그라데이션 플레어">
              <input
                className={inputCls()}
                value={block.data.bgImageUrl ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, bgImageUrl: e.target.value },
                  })
                }
              />
            </Field>
          </Fields>
        )}

        {block.type === "stats3year" && (
          <Fields>
            <EyebrowHeadline block={block} onChange={onChange} />
            <Field label="연도별 통계" hint="최대 3개. 방문객·해외바이어">
              <div className="space-y-2">
                {block.data.years.map((y, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center bg-ink-50/60 border border-ink-100 rounded-btn p-2"
                  >
                    <input
                      type="number"
                      placeholder="2025"
                      value={y.year}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            years: block.data.years.map((yy, j) =>
                              j === i
                                ? { ...yy, year: parseInt(e.target.value, 10) || 0 }
                                : yy
                            ),
                          },
                        })
                      }
                      className={inputCls() + " font-mono"}
                    />
                    <input
                      type="number"
                      placeholder="방문객 수"
                      value={y.visitors}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            years: block.data.years.map((yy, j) =>
                              j === i
                                ? {
                                    ...yy,
                                    visitors: parseInt(e.target.value, 10) || 0,
                                  }
                                : yy
                            ),
                          },
                        })
                      }
                      className={inputCls() + " font-mono"}
                    />
                    <input
                      type="number"
                      placeholder="해외바이어"
                      value={y.overseas ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            years: block.data.years.map((yy, j) =>
                              j === i
                                ? {
                                    ...yy,
                                    overseas: e.target.value
                                      ? parseInt(e.target.value, 10) || 0
                                      : undefined,
                                  }
                                : yy
                            ),
                          },
                        })
                      }
                      className={inputCls() + " font-mono"}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            years: block.data.years.filter((_, j) => j !== i),
                          },
                        })
                      }
                      className="w-8 h-8 grid place-items-center text-ink-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        years: [
                          ...block.data.years,
                          { year: new Date().getFullYear(), visitors: 0 },
                        ],
                      },
                    })
                  }
                  disabled={block.data.years.length >= 5}
                  className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[12.5px] text-ink-500 hover:border-ink-900 hover:text-ink-900 flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  연도 추가
                </button>
              </div>
            </Field>
            <Field label="설명 / 각주">
              <textarea
                className={inputCls() + " min-h-[60px]"}
                value={block.data.footnote ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, footnote: e.target.value },
                  })
                }
              />
            </Field>
          </Fields>
        )}

        {(block.type === "adGoals4" || block.type === "benefits4") && (
          <Fields>
            <EyebrowHeadline block={block} onChange={onChange} />
            <Field label={block.type === "adGoals4" ? "광고 목적 카드 4개" : "혜택 카드 4개"}>
              <div className="space-y-2">
                {block.data.cards.map((c, i) => (
                  <div
                    key={i}
                    className="bg-ink-50/60 border border-ink-100 rounded-btn p-2.5 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="이모지 (선택)"
                        value={c.emoji ?? ""}
                        onChange={(e) =>
                          updateCard(block, onChange, i, {
                            ...c,
                            emoji: e.target.value,
                          })
                        }
                        className={inputCls() + " w-16 text-center"}
                      />
                      <input
                        placeholder={
                          block.type === "adGoals4" ? "타입 라벨" : "혜택 제목"
                        }
                        value={
                          block.type === "adGoals4"
                            ? (c as { label: string }).label
                            : (c as { title: string }).title
                        }
                        onChange={(e) => {
                          if (block.type === "adGoals4") {
                            updateCard(block, onChange, i, {
                              ...c,
                              label: e.target.value,
                            });
                          } else {
                            updateCard(block, onChange, i, {
                              ...c,
                              title: e.target.value,
                            });
                          }
                        }}
                        className={inputCls() + " flex-1"}
                      />
                      <button
                        type="button"
                        onClick={() => removeCard(block, onChange, i)}
                        className="w-7 h-7 grid place-items-center text-ink-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      placeholder="설명"
                      value={c.description ?? ""}
                      onChange={(e) =>
                        updateCard(block, onChange, i, {
                          ...c,
                          description: e.target.value,
                        })
                      }
                      className={inputCls() + " min-h-[50px]"}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addCard(block, onChange)}
                  disabled={block.data.cards.length >= 6}
                  className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[12.5px] text-ink-500 hover:border-ink-900 hover:text-ink-900 flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  카드 추가
                </button>
              </div>
            </Field>
          </Fields>
        )}

        {block.type === "steps4" && (
          <Fields>
            <EyebrowHeadline block={block} onChange={onChange} />
            <Field label="신청 단계 (순서대로)">
              <div className="space-y-2">
                {block.data.steps.map((s, i) => (
                  <div
                    key={i}
                    className="bg-ink-50/60 border border-ink-100 rounded-btn p-2.5 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-ink-500 font-mono w-6 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <input
                        placeholder="단계 제목"
                        value={s.title}
                        onChange={(e) =>
                          onChange({
                            ...block,
                            data: {
                              ...block.data,
                              steps: block.data.steps.map((ss, j) =>
                                j === i ? { ...ss, title: e.target.value } : ss
                              ),
                            },
                          })
                        }
                        className={inputCls() + " flex-1"}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...block,
                            data: {
                              ...block.data,
                              steps: block.data.steps.filter(
                                (_, j) => j !== i
                              ),
                            },
                          })
                        }
                        className="w-7 h-7 grid place-items-center text-ink-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      placeholder="설명 (선택)"
                      value={s.description ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            steps: block.data.steps.map((ss, j) =>
                              j === i
                                ? { ...ss, description: e.target.value }
                                : ss
                            ),
                          },
                        })
                      }
                      className={inputCls() + " min-h-[50px]"}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        steps: [...block.data.steps, { title: "", description: "" }],
                      },
                    })
                  }
                  disabled={block.data.steps.length >= 6}
                  className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[12.5px] text-ink-500 hover:border-ink-900 hover:text-ink-900 flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  단계 추가
                </button>
              </div>
            </Field>
          </Fields>
        )}

        {block.type === "textHero" && (
          <Fields>
            <Field label="상단 라벨 (eyebrow)">
              <input
                className={inputCls()}
                value={block.data.eyebrow ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, eyebrow: e.target.value },
                  })
                }
              />
            </Field>
            <Field
              label="큰 텍스트 줄 (한 줄당 1행)"
              hint='빨강 강조하려면 줄 앞에 "*" 붙이기'
            >
              <textarea
                className={inputCls() + " min-h-[120px] font-mono"}
                value={(block.data.lines ?? []).join("\n")}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      lines: e.target.value.split("\n"),
                    },
                  })
                }
              />
            </Field>
            <Field label="설명">
              <textarea
                className={inputCls() + " min-h-[60px]"}
                value={block.data.description ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, description: e.target.value },
                  })
                }
              />
            </Field>
          </Fields>
        )}

        {block.type === "bigStat" && (
          <Fields>
            <Field label="상단 라벨">
              <input
                className={inputCls()}
                value={block.data.eyebrow ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, eyebrow: e.target.value },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="큰 숫자" required>
                <input
                  className={inputCls() + " font-mono"}
                  value={block.data.value ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      data: { ...block.data, value: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="단위/접미사">
                <input
                  className={inputCls()}
                  value={block.data.valueSuffix ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      data: { ...block.data, valueSuffix: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
            <Field label="설명 한 줄" required>
              <input
                className={inputCls()}
                value={block.data.label ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, label: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="추가 설명">
              <textarea
                className={inputCls() + " min-h-[60px]"}
                value={block.data.description ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, description: e.target.value },
                  })
                }
              />
            </Field>
          </Fields>
        )}

        {block.type === "cta" && (
          <Fields>
            <Field label="상단 라벨">
              <input
                className={inputCls()}
                value={block.data.eyebrow ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, eyebrow: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="큰 텍스트 줄들 (한 줄당 1행)">
              <textarea
                className={inputCls() + " min-h-[100px] font-mono"}
                value={(block.data.lines ?? []).join("\n")}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, lines: e.target.value.split("\n") },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="기본 버튼 라벨">
                <input
                  className={inputCls()}
                  placeholder="스폰서십 둘러보기"
                  value={block.data.primaryLabel ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      data: { ...block.data, primaryLabel: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="기본 버튼 링크">
                <input
                  className={inputCls() + " font-mono text-[11px]"}
                  placeholder="/sponsorships (기본)"
                  value={block.data.primaryHref ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      data: { ...block.data, primaryHref: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="보조 버튼 라벨">
                <input
                  className={inputCls()}
                  placeholder="바로 문의하기"
                  value={block.data.secondaryLabel ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      data: { ...block.data, secondaryLabel: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="보조 버튼 링크">
                <input
                  className={inputCls() + " font-mono text-[11px]"}
                  placeholder="/contact (기본)"
                  value={block.data.secondaryHref ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      data: { ...block.data, secondaryHref: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={block.data.showContact ?? false}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, showContact: e.target.checked },
                  })
                }
                className="accent-ink-900 w-4 h-4"
              />
              사무국 연락처 노출
            </label>
          </Fields>
        )}

        {block.type === "image" && (
          <Fields>
            <Field label="이미지 URL" required hint="Storage URL 또는 외부 URL">
              <input
                className={inputCls() + " font-mono text-[11.5px]"}
                value={block.data.url ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, url: e.target.value },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="대체 텍스트 (alt)">
                <input
                  className={inputCls()}
                  value={block.data.alt ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      data: { ...block.data, alt: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="캡션 (선택)">
                <input
                  className={inputCls()}
                  value={block.data.caption ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      data: { ...block.data, caption: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={block.data.fullBleed ?? false}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, fullBleed: e.target.checked },
                  })
                }
                className="accent-ink-900 w-4 h-4"
              />
              풀브리드 (화면 전체)
            </label>
          </Fields>
        )}

        {block.type === "richText" && (
          <Fields>
            <Field label="상단 라벨">
              <input
                className={inputCls()}
                value={block.data.eyebrow ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, eyebrow: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="제목 (선택)">
              <input
                className={inputCls()}
                value={block.data.headline ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, headline: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="본문" required>
              <textarea
                className={inputCls() + " min-h-[200px]"}
                value={block.data.body ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, body: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="정렬">
              <select
                className={inputCls()}
                value={block.data.align ?? "left"}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      align: e.target.value as "left" | "center",
                    },
                  })
                }
              >
                <option value="left">왼쪽</option>
                <option value="center">가운데</option>
              </select>
            </Field>
          </Fields>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 공통 컴포넌트들
// ============================================================================

function Fields({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-ink-700 font-semibold mb-1 block">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-ink-500 mt-1 block">{hint}</span>}
    </label>
  );
}

function inputCls(): string {
  return "w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-ink-900 bg-white";
}

// ============================================================================
// AdGoals4 / Benefits4 카드 편집 헬퍼
// ============================================================================

type Card4Block =
  | Extract<LandingBlock, { type: "adGoals4" }>
  | Extract<LandingBlock, { type: "benefits4" }>;

function updateCard(
  block: Card4Block,
  onChange: (b: LandingBlock) => void,
  i: number,
  patch: Card4Block["data"]["cards"][number]
) {
  if (block.type === "adGoals4") {
    onChange({
      ...block,
      data: {
        ...block.data,
        cards: block.data.cards.map((c, j) =>
          j === i ? (patch as (typeof block.data.cards)[number]) : c
        ),
      },
    });
  } else {
    onChange({
      ...block,
      data: {
        ...block.data,
        cards: block.data.cards.map((c, j) =>
          j === i ? (patch as (typeof block.data.cards)[number]) : c
        ),
      },
    });
  }
}

function removeCard(
  block: Card4Block,
  onChange: (b: LandingBlock) => void,
  i: number
) {
  if (block.type === "adGoals4") {
    onChange({
      ...block,
      data: {
        ...block.data,
        cards: block.data.cards.filter((_, j) => j !== i),
      },
    });
  } else {
    onChange({
      ...block,
      data: {
        ...block.data,
        cards: block.data.cards.filter((_, j) => j !== i),
      },
    });
  }
}

function addCard(block: Card4Block, onChange: (b: LandingBlock) => void) {
  if (block.type === "adGoals4") {
    onChange({
      ...block,
      data: {
        ...block.data,
        cards: [...block.data.cards, { label: "", description: "" }],
      },
    });
  } else {
    onChange({
      ...block,
      data: {
        ...block.data,
        cards: [...block.data.cards, { title: "", description: "" }],
      },
    });
  }
}

// ============================================================================
// EyebrowHeadline — 공통 라벨/헤드라인 페어
// ============================================================================

type HeadlineBlock =
  | Extract<LandingBlock, { type: "stats3year" }>
  | Extract<LandingBlock, { type: "adGoals4" }>
  | Extract<LandingBlock, { type: "benefits4" }>
  | Extract<LandingBlock, { type: "steps4" }>;

function EyebrowHeadline({
  block,
  onChange,
}: {
  block: HeadlineBlock;
  onChange: (b: LandingBlock) => void;
}) {
  return (
    <>
      <Field label="상단 라벨 (eyebrow)" hint="대문자, 짧게. 예: ad goals">
        <input
          className={inputCls()}
          value={block.data.eyebrow ?? ""}
          onChange={(e) =>
            onChange({
              ...block,
              data: { ...block.data, eyebrow: e.target.value },
            } as LandingBlock)
          }
        />
      </Field>
      <Field label="헤드라인" required>
        <input
          className={inputCls()}
          value={block.data.headline ?? ""}
          onChange={(e) =>
            onChange({
              ...block,
              data: { ...block.data, headline: e.target.value },
            } as LandingBlock)
          }
        />
      </Field>
    </>
  );
}
