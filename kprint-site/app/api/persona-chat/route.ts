import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

/**
 * AI 페르소나 추천 챗 API.
 *
 * 클라이언트가 보내는 데이터:
 *   - messages: 이전 대화 + 새 user 메시지
 *   - context: 현재 행사의 personas / categories / packages 요약
 *
 * 응답:
 *   - 텍스트 답변
 *   - (마지막에) JSON 블록 — 추천 콤보가 있을 때
 *
 * 환경: ANTHROPIC_API_KEY (App Hosting secret 또는 .env.local)
 *
 * 프롬프트 캐싱: 시스템 프롬프트 + 행사 컨텍스트를 cache_control 로 표시해
 * 비용·속도 최적화 (5분 TTL).
 */

const MODEL = "claude-haiku-4-5-20251001";

type ClientMessage = { role: "user" | "assistant"; content: string };

type ChatContext = {
  eventName?: string;
  personas?: Array<{
    id: string;
    title: string;
    description: string;
    budgetMin?: number;
    budgetMax?: number;
    purposes?: string[];
  }>;
  categories?: Array<{
    slug: string;
    name: string;
    type: string;
    channel: string;
    minPrice?: number;
    purposes?: string[];
    available?: number;
    total?: number;
  }>;
  packages?: Array<{
    id: string;
    name: string;
    tier: string;
    price: number;
  }>;
};

function buildSystemPrompt(ctx: ChatContext): string {
  return `당신은 전시회 스폰서십을 추천하는 AI 컨설턴트입니다.

# 행사
${ctx.eventName ?? "(행사명 미정)"}

# 페르소나 (참고용 — 사용자의 상황을 가장 가까운 것에 매핑하세요)
${(ctx.personas ?? [])
  .map(
    (p) =>
      `- [${p.id}] ${p.title}: ${p.description}${
        p.budgetMin || p.budgetMax
          ? ` (예산: ${p.budgetMin ?? 0}~${p.budgetMax ?? "∞"}원)`
          : ""
      }`
  )
  .join("\n")}

# 사용 가능한 스폰서십 카테고리
${(ctx.categories ?? [])
  .slice(0, 60)
  .map(
    (c) =>
      `- ${c.slug} | ${c.name} (${c.type}, ${c.channel}) | 최저가 ${
        c.minPrice?.toLocaleString() ?? "협의"
      }원 | 잔여 ${c.available ?? "?"}/${c.total ?? "?"} | 목적: ${
        c.purposes?.join("·") ?? ""
      }`
  )
  .join("\n")}

# 사용 가능한 패키지
${(ctx.packages ?? [])
  .map((p) => `- ${p.id} | ${p.name} (${p.tier}) | ${p.price.toLocaleString()}원`)
  .join("\n")}

# 행동 지침
1. 처음 3~5턴은 짧은 질문으로 정보 수집: 예산 / 목적(부스 방문 유도·브랜드 인지·바이어 도달·사후 자산) / 부스 위치(있다면) / 작년 경험 / 핵심 KPI.
2. 사용자 답변에서 핵심을 정리해서 한 번 더 확인 ("정리하면…").
3. 적절한 페르소나 1개를 선택하고, **구체적 카테고리 slug 1~3개 + 패키지 0~1개** 를 추천하세요. 예산 범위 안에서.
4. 추천을 줄 때 마지막에 정확히 이 JSON 블록을 포함하세요 (다른 텍스트 뒤에):
\`\`\`json
{
  "personaId": "[페르소나 id]",
  "categorySlugs": ["slug1", "slug2"],
  "packageIds": ["pkg-id"],
  "rationale": "한 줄 이유"
}
\`\`\`
JSON 안에 추측이나 가짜 ID 넣지 마세요. 위 컨텍스트에 있는 것만 사용.
5. 한국어로, 짧고 자연스럽게. 마케팅 문구·이모지 남발 X. 사용자 시점으로 대화.
6. 사용자가 막연하게 질문하면 가장 자주 묻는 정보 1개부터 물어보세요. 한 번에 하나씩.`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "ANTHROPIC_API_KEY 가 서버에 설정되지 않았습니다.",
      },
      { status: 500 }
    );
  }

  let body: {
    messages: ClientMessage[];
    context: ChatContext;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages 가 비어있습니다." },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = buildSystemPrompt(context);

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: systemPrompt,
          // 5분 캐싱 — 같은 대화 안에서 시스템 프롬프트 재사용
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = resp.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");

    // 마지막 JSON 블록 추출 (추천 결과)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    let recommendation: unknown = null;
    if (jsonMatch) {
      try {
        recommendation = JSON.parse(jsonMatch[1]);
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      reply: text.replace(/```json[\s\S]*?```/, "").trim(),
      recommendation,
      cache: {
        cached: resp.usage.cache_read_input_tokens ?? 0,
        created: resp.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("anthropic api error", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
