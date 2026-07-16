// 서버 컴포넌트(generateMetadata)용 행사 조회 — Firestore REST API 사용.
//
// 클라이언트 SDK(getDb/getDoc)는 Node 서버 런타임에서 초기화/전송 계층 문제로
// 조용히 실패할 수 있어, 메타데이터처럼 "행사명 한 필드"만 필요한 경우엔
// 공개 read 권한(events)을 이용한 REST 단건 조회가 가장 견고하다.
// Next fetch 캐시(revalidate)로 요청당 재조회도 방지.

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export async function getEventNameForMetadata(
  eventSlug: string
): Promise<string | null> {
  if (!PROJECT_ID || !API_KEY) return null;
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
      `/databases/(default)/documents/events/${encodeURIComponent(eventSlug)}` +
      `?key=${API_KEY}&mask.fieldPaths=name`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      fields?: { name?: { stringValue?: string } };
    };
    return json.fields?.name?.stringValue ?? null;
  } catch {
    return null;
  }
}
