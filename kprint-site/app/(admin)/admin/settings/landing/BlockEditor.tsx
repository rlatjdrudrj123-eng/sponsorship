"use client";

import { Plus, Trash2 } from "lucide-react";
import type { BlockStyle, CanvasPage, LandingBlock } from "@/lib/types";
import { BLOCK_TYPE_META } from "@/components/public/landing/defaults";
import { CanvasEditor } from "./canvas/CanvasEditor";

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

        {block.type === "twoColumn" && (
          <Fields>
            <Field label="비율">
              <select
                className={inputCls()}
                value={block.data.ratio ?? "1:1"}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      ratio: e.target.value as "1:1" | "1.5:1" | "1:1.5",
                    },
                  })
                }
              >
                <option value="1:1">좌·우 동등</option>
                <option value="1.5:1">왼쪽 넓게</option>
                <option value="1:1.5">오른쪽 넓게</option>
              </select>
            </Field>
            <ColumnEditor
              title="왼쪽 컬럼"
              side={block.data.left}
              onSide={(s) =>
                onChange({ ...block, data: { ...block.data, left: s } })
              }
            />
            <ColumnEditor
              title="오른쪽 컬럼"
              side={block.data.right}
              onSide={(s) =>
                onChange({ ...block, data: { ...block.data, right: s } })
              }
            />
          </Fields>
        )}

        {block.type === "imageGrid" && (
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
            <Field label="제목">
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
            <Field label="컬럼 수">
              <select
                className={inputCls()}
                value={block.data.columns}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      columns: parseInt(e.target.value, 10) as 2 | 3 | 4 | 5 | 6,
                    },
                  })
                }
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}열
                  </option>
                ))}
              </select>
            </Field>
            <Field label="이미지 (URL + alt + 캡션)">
              <div className="space-y-2">
                {block.data.images.map((img, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center bg-ink-50/60 border border-ink-100 rounded-btn p-2"
                  >
                    <input
                      placeholder="URL"
                      value={img.url}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            images: block.data.images.map((m, j) =>
                              j === i ? { ...m, url: e.target.value } : m
                            ),
                          },
                        })
                      }
                      className={inputCls() + " font-mono text-[11px]"}
                    />
                    <input
                      placeholder="alt"
                      value={img.alt ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            images: block.data.images.map((m, j) =>
                              j === i ? { ...m, alt: e.target.value } : m
                            ),
                          },
                        })
                      }
                      className={inputCls()}
                    />
                    <input
                      placeholder="캡션"
                      value={img.caption ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            images: block.data.images.map((m, j) =>
                              j === i ? { ...m, caption: e.target.value } : m
                            ),
                          },
                        })
                      }
                      className={inputCls()}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            images: block.data.images.filter((_, j) => j !== i),
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
                        images: [...block.data.images, { url: "" }],
                      },
                    })
                  }
                  className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[12.5px] text-ink-500 hover:border-ink-900 hover:text-ink-900 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  이미지 추가
                </button>
              </div>
            </Field>
          </Fields>
        )}

        {block.type === "divider" && (
          <Fields>
            <Field label="라벨 (선택)" hint="구분선 가운데 표시 (예: Appendix)">
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
            <label className="flex items-center gap-2 text-[12.5px] text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={block.data.accent ?? false}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, accent: e.target.checked },
                  })
                }
                className="accent-ink-900 w-4 h-4"
              />
              브랜드 빨강 강조
            </label>
          </Fields>
        )}

        {block.type === "spacer" && (
          <Fields>
            <Field label="크기">
              <select
                className={inputCls()}
                value={block.data.size}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      size: e.target.value as "sm" | "md" | "lg" | "xl",
                    },
                  })
                }
              >
                <option value="sm">작게 (8vh)</option>
                <option value="md">보통 (20vh)</option>
                <option value="lg">크게 (40vh)</option>
                <option value="xl">아주 크게 (60vh)</option>
              </select>
            </Field>
          </Fields>
        )}

        {block.type === "buttonRow" && (
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
            <Field label="제목">
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
            <Field label="버튼">
              <div className="space-y-2">
                {block.data.buttons.map((b, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1.4fr_2fr_1fr_auto] gap-2 items-center bg-ink-50/60 border border-ink-100 rounded-btn p-2"
                  >
                    <input
                      placeholder="라벨"
                      value={b.label}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            buttons: block.data.buttons.map((bb, j) =>
                              j === i ? { ...bb, label: e.target.value } : bb
                            ),
                          },
                        })
                      }
                      className={inputCls()}
                    />
                    <input
                      placeholder="링크 (/sponsorships, https://…)"
                      value={b.href}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            buttons: block.data.buttons.map((bb, j) =>
                              j === i ? { ...bb, href: e.target.value } : bb
                            ),
                          },
                        })
                      }
                      className={inputCls() + " font-mono text-[11px]"}
                    />
                    <select
                      value={b.variant ?? "primary"}
                      onChange={(e) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            buttons: block.data.buttons.map((bb, j) =>
                              j === i
                                ? {
                                    ...bb,
                                    variant: e.target.value as
                                      | "primary"
                                      | "outline"
                                      | "ghost",
                                  }
                                : bb
                            ),
                          },
                        })
                      }
                      className={inputCls()}
                    >
                      <option value="primary">기본 (빨강)</option>
                      <option value="outline">아웃라인</option>
                      <option value="ghost">고스트</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            buttons: block.data.buttons.filter(
                              (_, j) => j !== i
                            ),
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
                        buttons: [
                          ...block.data.buttons,
                          { label: "", href: "", variant: "primary" },
                        ],
                      },
                    })
                  }
                  className="w-full py-2 rounded-btn border-[1.5px] border-dashed border-ink-300 text-[12.5px] text-ink-500 hover:border-ink-900 hover:text-ink-900 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  버튼 추가
                </button>
              </div>
            </Field>
          </Fields>
        )}

        {block.type === "videoEmbed" && (
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
            <Field label="제목">
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
            <Field
              label="동영상 URL"
              required
              hint="YouTube · Vimeo · mp4 URL"
            >
              <input
                className={inputCls() + " font-mono text-[11.5px]"}
                value={block.data.url}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, url: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="비율">
              <select
                className={inputCls()}
                value={block.data.aspect ?? "16:9"}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      aspect: e.target.value as
                        | "16:9"
                        | "4:3"
                        | "1:1"
                        | "9:16",
                    },
                  })
                }
              >
                <option value="16:9">16:9 가로</option>
                <option value="4:3">4:3</option>
                <option value="1:1">1:1 정사각</option>
                <option value="9:16">9:16 세로</option>
              </select>
            </Field>
          </Fields>
        )}

        {block.type === "customHtml" && (
          <Fields>
            <Field
              label="HTML"
              hint="⚠️ 운영자 신뢰 전제. XSS 위험 없는 마크업만 사용하세요."
            >
              <textarea
                className={inputCls() + " min-h-[280px] font-mono text-[12px]"}
                value={block.data.html ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { html: e.target.value },
                  })
                }
              />
            </Field>
          </Fields>
        )}

        {block.type === "canvasPage" && (
          <div className="-mx-5 -my-5">
            <CanvasEditor
              page={block.data.page}
              onChange={(page: CanvasPage) =>
                onChange({ ...block, data: { page } })
              }
            />
          </div>
        )}

        {block.type === "pdfDownload" && (
          <Fields>
            <Field label="상단 라벨" hint="작은 위쪽 텍스트 (예: Download)">
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
            <Field label="제목">
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
            <Field label="설명">
              <textarea
                rows={3}
                className={inputCls()}
                value={block.data.description ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, description: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="버튼 라벨">
              <input
                className={inputCls()}
                value={block.data.buttonLabel ?? ""}
                placeholder="전체 패키지 PDF 다운로드"
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, buttonLabel: e.target.value },
                  })
                }
              />
            </Field>
            <p className="text-[11.5px] text-ink-500 leading-relaxed">
              버튼은 현재 행사의 <code className="font-mono">/print/full</code>{" "}
              미리보기로 새 탭에서 열립니다. 인쇄 다이얼로그가 자동 실행되며
              사용자는 [PDF로 저장]으로 다운로드합니다.
            </p>
          </Fields>
        )}

        {block.type === "slotsTeaser" && (
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
            <Field label="제목">
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
            <Field
              label="카테고리 slug (콤마 구분)"
              hint="예: ceiling-banner-hall-a, xpace-bridge"
            >
              <input
                className={inputCls() + " font-mono text-[12px]"}
                value={(block.data.categorySlugs ?? []).join(", ")}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      categorySlugs: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            </Field>
            <Field label="레이아웃">
              <select
                className={inputCls()}
                value={block.data.layout ?? "grid"}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      layout: e.target.value as "grid" | "row",
                    },
                  })
                }
              >
                <option value="grid">그리드 (3열)</option>
                <option value="row">가로 스크롤</option>
              </select>
            </Field>
          </Fields>
        )}

        {/* ─── 공통: 스타일 패널 ─── */}
        <div className="mt-6 pt-5 border-t border-ink-100">
          <StylePanel
            value={block.style}
            onChange={(s) => onChange({ ...block, style: s })}
          />
        </div>
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
// 공통 스타일 패널 — 모든 블록의 style override
// ============================================================================

const BG_PRESETS: Array<{ id: string; label: string; preview: string }> = [
  { id: "", label: "기본", preview: "#F6F6F6" },
  { id: "canvas", label: "캔버스 (회색)", preview: "#F6F6F6" },
  { id: "surface", label: "흰색", preview: "#FFFFFF" },
  { id: "ink", label: "검정 (다크)", preview: "#0A0A0A" },
  { id: "brand", label: "브랜드 (빨강)", preview: "#DB0711" },
  { id: "transparent", label: "투명", preview: "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc) 0 0/12px 12px, linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc) 6px 6px/12px 12px" },
];

function StylePanel({
  value,
  onChange,
}: {
  value?: BlockStyle;
  onChange: (s: BlockStyle | undefined) => void;
}) {
  const v = value ?? {};
  const patch = (p: Partial<BlockStyle>) => {
    const next: BlockStyle = { ...v, ...p };
    // null/빈 값 정리
    Object.keys(next).forEach((k) => {
      const val = (next as Record<string, unknown>)[k];
      if (val === "" || val === undefined) {
        delete (next as Record<string, unknown>)[k];
      }
    });
    onChange(Object.keys(next).length === 0 ? undefined : next);
  };

  return (
    <details className="group">
      <summary className="cursor-pointer text-[12px] uppercase tracking-widest text-ink-500 font-semibold flex items-center gap-1.5 list-none">
        <span className="inline-block transition-transform group-open:rotate-90">›</span>
        스타일 (블록 단위 override)
        {value && Object.keys(value).length > 0 && (
          <span className="ml-1.5 text-[10px] bg-mint-50 text-mint-700 px-1.5 py-0.5 rounded font-mono normal-case tracking-normal" style={{ background: "#FEE9EA", color: "#AA0008" }}>
            {Object.keys(value).length}개 적용
          </span>
        )}
      </summary>
      <div className="mt-4 space-y-4">
        {/* 배경 */}
        <Field
          label="배경"
          hint="키워드 (canvas/surface/ink/brand) 또는 hex 직접 입력"
        >
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {BG_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => patch({ bg: p.id || undefined })}
                  className={
                    "px-2 py-2 rounded-btn border-2 text-[11.5px] font-semibold flex flex-col items-center gap-1 transition-colors " +
                    ((v.bg ?? "") === p.id
                      ? "border-ink-900"
                      : "border-ink-100 hover:border-ink-300")
                  }
                >
                  <span
                    className="w-full h-6 rounded border border-ink-100"
                    style={{ background: p.preview }}
                  />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="#FFFFFF (커스텀 hex)"
              value={v.bg && !BG_PRESETS.some((p) => p.id === v.bg) ? v.bg : ""}
              onChange={(e) => patch({ bg: e.target.value })}
              className={inputCls() + " font-mono text-[12px]"}
            />
          </div>
        </Field>

        {/* 텍스트 색 */}
        <Field label="텍스트 색" hint="hex 직접 입력 (비우면 자동)">
          <div className="flex gap-2">
            <input
              type="color"
              value={v.text ?? "#0A0A0A"}
              onChange={(e) => patch({ text: e.target.value })}
              className="w-12 h-9 rounded-btn border border-ink-100 cursor-pointer bg-white"
            />
            <input
              type="text"
              placeholder="#0A0A0A"
              value={v.text ?? ""}
              onChange={(e) => patch({ text: e.target.value })}
              className={inputCls() + " font-mono text-[12px]"}
            />
            {v.text && (
              <button
                type="button"
                onClick={() => patch({ text: undefined })}
                className="px-2 text-[11px] text-ink-500 hover:text-red-700"
              >
                초기화
              </button>
            )}
          </div>
        </Field>

        {/* 액센트 색 */}
        <Field
          label="액센트 (brand override)"
          hint="이 블록만 다른 brand color 적용. 비우면 행사 기본."
        >
          <div className="flex gap-2">
            <input
              type="color"
              value={v.accent ?? "#DB0711"}
              onChange={(e) => patch({ accent: e.target.value })}
              className="w-12 h-9 rounded-btn border border-ink-100 cursor-pointer bg-white"
            />
            <input
              type="text"
              placeholder="#DB0711"
              value={v.accent ?? ""}
              onChange={(e) => patch({ accent: e.target.value })}
              className={inputCls() + " font-mono text-[12px]"}
            />
            {v.accent && (
              <button
                type="button"
                onClick={() => patch({ accent: undefined })}
                className="px-2 text-[11px] text-ink-500 hover:text-red-700"
              >
                초기화
              </button>
            )}
          </div>
        </Field>

        {/* 정렬 */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="정렬">
            <select
              className={inputCls()}
              value={v.align ?? "left"}
              onChange={(e) =>
                patch({ align: e.target.value as BlockStyle["align"] })
              }
            >
              <option value="left">왼쪽</option>
              <option value="center">가운데</option>
              <option value="right">오른쪽</option>
            </select>
          </Field>
          <Field label="최소 높이">
            <select
              className={inputCls()}
              value={v.minHeight ?? "screen"}
              onChange={(e) =>
                patch({ minHeight: e.target.value as BlockStyle["minHeight"] })
              }
            >
              <option value="screen">풀스크린</option>
              <option value="half">반화면</option>
              <option value="auto">자동</option>
            </select>
          </Field>
          <Field label="패딩">
            <select
              className={inputCls()}
              value={v.pad ?? "normal"}
              onChange={(e) =>
                patch({ pad: e.target.value as BlockStyle["pad"] })
              }
            >
              <option value="tight">좁게</option>
              <option value="normal">보통</option>
              <option value="loose">넓게</option>
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-[12.5px] text-ink-700 cursor-pointer">
          <input
            type="checkbox"
            checked={v.fullBleed ?? false}
            onChange={(e) => patch({ fullBleed: e.target.checked })}
            className="accent-ink-900 w-4 h-4"
          />
          풀브리드 (가로 폭 제한 해제)
        </label>

        {value && Object.keys(value).length > 0 && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[11px] text-ink-500 hover:text-red-700 font-semibold"
          >
            ↺ 스타일 전체 초기화
          </button>
        )}
      </div>
    </details>
  );
}

// ============================================================================
// TwoColumn 한쪽 컬럼 에디터
// ============================================================================

type Side = {
  kind: "text" | "image";
  eyebrow?: string;
  headline?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
};

function ColumnEditor({
  title,
  side,
  onSide,
}: {
  title: string;
  side: Side;
  onSide: (s: Side) => void;
}) {
  return (
    <div className="bg-ink-50/60 border border-ink-100 rounded-btn p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-ink-900">{title}</span>
        <div className="inline-flex bg-white border border-ink-100 rounded-btn p-0.5">
          <button
            type="button"
            onClick={() => onSide({ ...side, kind: "text" })}
            className={
              "px-2.5 py-1 rounded text-[11px] font-semibold " +
              (side.kind === "text"
                ? "bg-ink-900 text-white"
                : "text-ink-500 hover:text-ink-900")
            }
          >
            텍스트
          </button>
          <button
            type="button"
            onClick={() => onSide({ ...side, kind: "image" })}
            className={
              "px-2.5 py-1 rounded text-[11px] font-semibold " +
              (side.kind === "image"
                ? "bg-ink-900 text-white"
                : "text-ink-500 hover:text-ink-900")
            }
          >
            이미지
          </button>
        </div>
      </div>
      {side.kind === "text" ? (
        <>
          <input
            placeholder="상단 라벨"
            value={side.eyebrow ?? ""}
            onChange={(e) => onSide({ ...side, eyebrow: e.target.value })}
            className={inputCls()}
          />
          <input
            placeholder="제목"
            value={side.headline ?? ""}
            onChange={(e) => onSide({ ...side, headline: e.target.value })}
            className={inputCls()}
          />
          <textarea
            placeholder="본문"
            value={side.body ?? ""}
            onChange={(e) => onSide({ ...side, body: e.target.value })}
            className={inputCls() + " min-h-[80px]"}
          />
        </>
      ) : (
        <>
          <input
            placeholder="이미지 URL"
            value={side.imageUrl ?? ""}
            onChange={(e) => onSide({ ...side, imageUrl: e.target.value })}
            className={inputCls() + " font-mono text-[12px]"}
          />
          <input
            placeholder="alt (선택)"
            value={side.imageAlt ?? ""}
            onChange={(e) => onSide({ ...side, imageAlt: e.target.value })}
            className={inputCls()}
          />
        </>
      )}
    </div>
  );
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
