/**
 * 일회성 샘플 이미지 시드 — KIMES 40개 카테고리 매핑.
 *
 * category.code 기준으로 매핑된 Unsplash 이미지·텍스트를 일괄 주입.
 * 기존 이미지/텍스트는 덮어씀. isPublished를 true로 변경.
 *
 * heroMode 결정 규칙:
 *   - type === 'quantity' || 'print_page' → 'gallery'
 *   - type === 'media' → 'single'
 *   - 그 외 → 'carousel'
 *
 * 매핑에 없는 코드는 스킵하고 결과 보고에 표시.
 *
 * 외부 Unsplash URL을 그대로 Firestore에 저장하므로 Storage 업로드 없음
 * (storagePath 빈 문자열). 운영 전 제거 권장.
 */

"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "../firebase/firestore";
import type {
  Category,
  FloorImage,
  ImageItem,
  ImageSlot,
  Subcategory,
} from "../types";

type SampleEntry = {
  shortDesc: string;
  longDesc: string;
  hero: string[];
  detail?: string[];
  floor?: string[];
};

const SAMPLE_DATA: Record<string, SampleEntry> = {
  // ============ XPACE 시리즈 ============
  XPA: {
    shortDesc: "전시장 진입 동선의 대형 옥외 LED — 브릿지 구간을 가득 채우는 영상.",
    longDesc:
      "브릿지 4면 + 빅브릿지 동시 송출. 영상 광고로 강한 시각적 임팩트 확보. 전시장 진입 시점부터 브랜드를 각인시키는 가장 효과적인 옥외 매체.",
    hero: [
      "https://images.unsplash.com/photo-1565035010268-a3816f98589a?w=1600&q=80",
      "https://images.unsplash.com/photo-1574169208507-84376144848b?w=1600&q=80",
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=80",
    ],
    floor: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80"],
  },
  XPB: {
    shortDesc: "와이드 + 스퀘어 LED — 전시장 중앙 동선의 핵심 사이니지.",
    longDesc:
      "와이드 브릿지와 스퀘어 브릿지 동시 송출. 가성비 좋은 옥외 영상 광고로 행사 기간 7일간 노출.",
    hero: [
      "https://images.unsplash.com/photo-1574169208507-84376144848b?w=1600&q=80",
      "https://images.unsplash.com/photo-1565035010268-a3816f98589a?w=1600&q=80",
    ],
    floor: ["https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&q=80"],
  },
  XPE: {
    shortDesc: "엣지컬럼 LED — 전시장 외곽 기둥형 디스플레이.",
    longDesc: "기둥형 LED로 다양한 각도에서 노출. 영상 광고 7일간 송출.",
    hero: [
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=80",
      "https://images.unsplash.com/photo-1503095396549-807759245b35?w=1600&q=80",
    ],
    floor: ["https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&q=80"],
  },

  // ============ 천장 배너 ============
  CBA: {
    shortDesc: "Hall A 천장 배너 — 진입 시 가장 먼저 시야에 들어오는 자리.",
    longDesc:
      "Hall A 천장에 설치되는 대형 배너 7구좌. 라이팅으로 가독성 확보, 멀리서도 식별 가능. 브랜드 인지 확산형 광고로 가장 많이 선택되는 항목.",
    hero: [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80",
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=1600&q=80",
    ],
    floor: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80"],
  },
  CBB: {
    shortDesc: "Hall B 천장 배너 — 메인 동선 중앙.",
    longDesc: "Hall B 천장 6구좌. 행사장 중앙부 동선의 시각적 앵커.",
    hero: [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80",
      "https://images.unsplash.com/photo-1591115765373-5207764f72e4?w=1600&q=80",
    ],
    floor: ["https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&q=80"],
  },
  CBC: {
    shortDesc: "Hall C 천장 배너 — 후반부 동선의 마지막 인지점.",
    longDesc:
      "Hall C 천장 7구좌. 참관객의 마지막 시각 노출 지점으로 잔상 효과가 큰 자리.",
    hero: [
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=1600&q=80",
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80",
    ],
    floor: ["https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&q=80"],
  },

  // ============ 등록대 ============
  RGA: {
    shortDesc: "Hall A 등록데스크 — 모든 참관객이 거치는 첫 접점.",
    longDesc:
      "A1·A2 출입구 등록 데스크 9구좌 (A1 5구좌 + A2 4구좌). 사전 등록자·현장 등록자 모두가 거치는 동선의 핵심.",
    hero: [
      "https://images.unsplash.com/photo-1591115765373-5207764f72e4?w=1600&q=80",
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=1600&q=80",
    ],
    floor: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80"],
  },
  RGB: {
    shortDesc: "Hall B 등록데스크 — 보조 입구 동선.",
    longDesc: "Hall B 출입구 등록 데스크 2구좌.",
    hero: ["https://images.unsplash.com/photo-1591115765373-5207764f72e4?w=1600&q=80"],
    floor: ["https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&q=80"],
  },
  RGC: {
    shortDesc: "Hall C 등록데스크 — 후반부 입장 동선.",
    longDesc: "Hall C 출입구 등록 데스크 3구좌.",
    hero: ["https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=1600&q=80"],
    floor: ["https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&q=80"],
  },
  RGD: {
    shortDesc: "Hall D 등록데스크 — 단독 노출 자리.",
    longDesc: "Hall D 출입구 등록 데스크 1구좌. 단독 노출로 경쟁 없이 브랜드 각인.",
    hero: ["https://images.unsplash.com/photo-1591115765373-5207764f72e4?w=1600&q=80"],
    floor: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80"],
  },

  // ============ 수량형 ============
  BGE: {
    shortDesc: "사전 + 현장 등록자 전원이 착용하는 목걸이 — 노출 시간이 가장 긴 매체.",
    longDesc:
      "5만개 단위 제작·배포. 행사 기간 내내 모든 참관객이 행사장을 누비며 노출. 기본구좌 5,000개 + 추가 1구좌당 5,000개로 최대 10구좌까지 확장.",
    hero: [
      "https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=1600&q=80",
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1600&q=80",
      "https://images.unsplash.com/photo-1561070791-2526d30994b8?w=1600&q=80",
      "https://images.unsplash.com/photo-1559223607-b4d0555ae227?w=1600&q=80",
    ],
  },
  IVL: {
    shortDesc: "10만 단위 발송 — 가장 직접적인 초청 매체. 2개 업체 한정.",
    longDesc:
      "K-PRINT 공식 초청장에 함께 발송되는 삽지. 사전 등록 단계에서 노출. 국내 바이어 10만명 이상 대상.",
    hero: [
      "https://images.unsplash.com/photo-1579208030886-b937da0925dc?w=1600&q=80",
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1600&q=80",
    ],
  },

  // ============ 미디어 ============
  LDL: {
    shortDesc: "경품 이벤트 시간대 집중 노출 LED 영상 광고.",
    longDesc:
      "D홀·E홀에 설치. 영상 길이 최대 15초, 총 5개 구좌. 참관객이 가장 집중하는 이벤트 타임슬롯에 노출. 경품 협찬으로 대체 가능.",
    hero: [
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=80",
      "https://images.unsplash.com/photo-1503095396549-807759245b35?w=1600&q=80",
    ],
  },

  // ============ 도면형 (기타) ============
  FST: {
    shortDesc: "전시장 내부 바닥 스티커 — 동선 유도와 위치 안내.",
    longDesc:
      "전시장 내부 주요 동선에 설치되는 바닥 그래픽. 부스 안내와 브랜드 노출을 동시에.",
    hero: [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80",
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&q=80",
    ],
    floor: ["https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&q=80"],
  },
  LTW: {
    shortDesc: "라이팅월 — 백라이트 대형 디스플레이 4구좌.",
    longDesc:
      "전시장 주요 위치에 설치되는 백라이트 라이팅월. 시인성 높은 자리에서 강한 브랜드 노출.",
    hero: [
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=1600&q=80",
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80",
    ],
    floor: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80"],
  },

  // ============ 지면형 ============
  GDB: {
    shortDesc: "현장 쇼가이드 — 모든 참관객이 받아 가는 인쇄 매체.",
    longDesc:
      "표4(뒷표지) / 표2(표지 뒷면) / 표3(뒷표지 앞면) 위치 선택 가능. 국문/영문 별도 옵션. 행사 기간 내내 참관객 손에 머무는 매체.",
    hero: [
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1600&q=80",
      "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=1600&q=80",
      "https://images.unsplash.com/photo-1532153975070-2e9ab71f1b14?w=1600&q=80",
    ],
  },

  // ============ 디지털 배너 ============
  RGS: {
    shortDesc: "참관등록 페이지 배너 — 단독 노출. 1개 업체 한정.",
    longDesc:
      "K-PRINT 공식 홈페이지의 참관등록 페이지 상단 배너. 등록 단계의 모든 방문자에게 노출되는 단독 매체.",
    hero: [
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&q=80",
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&q=80",
    ],
  },
  RGM: {
    shortDesc: "참관등록 완료 이메일 — 등록 직후 도달하는 이메일 상단 배너.",
    longDesc:
      "참관 등록을 완료한 모든 사용자에게 발송되는 확인 이메일에 노출. 1개 업체 한정의 단독 매체.",
    hero: [
      "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=1600&q=80",
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1600&q=80",
    ],
  },
  TTS: {
    shortDesc: "통합검색 페이지 배너 — 정보 탐색 활동의 핵심.",
    longDesc:
      "K-PRINT 공식 사이트의 통합검색 결과 페이지 상단. 참관객이 가장 활발하게 정보를 찾는 자리. 5구좌.",
    hero: [
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&q=80",
      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1600&q=80",
    ],
  },
  PRS: {
    shortDesc: "전시품 검색 페이지 배너 — 구매 의향 높은 방문자 타겟.",
    longDesc:
      "전시품을 직접 검색하는 사용자에게 노출. 구매 결정 직전의 타겟에게 도달하는 5구좌.",
    hero: [
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&q=80",
      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1600&q=80",
    ],
  },
  EXS: {
    shortDesc: "참가업체 검색 페이지 배너 — 경쟁사 검색에 동반 노출.",
    longDesc:
      "참가업체를 검색하는 사용자에게 노출. 경쟁사 페이지를 보는 타겟에게도 도달하는 5구좌.",
    hero: [
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&q=80",
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&q=80",
    ],
  },
  SMR: {
    shortDesc: "세미나 페이지 배너 — 산업 종사자 집중 타겟.",
    longDesc:
      "세미나·컨퍼런스 정보를 찾는 산업 종사자에게 노출. 의사결정 권한이 높은 5구좌 타겟 매체.",
    hero: [
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&q=80",
      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1600&q=80",
    ],
  },
  FPS: {
    shortDesc: "전시장 도면 페이지 하단 배너 — 가장 비싼 단독 자리.",
    longDesc:
      "도면 검색 페이지 하단의 단독 배너. 부스 위치를 확인하는 모든 방문자에게 노출. 1개 업체 한정.",
    hero: [
      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1600&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80",
    ],
  },
  FPL: {
    shortDesc: "도면 내 참가기업 로고 표기 — 4부스 이상 기업 한정.",
    longDesc:
      "공식 홈페이지·홍보리플렛·가이드북·현황판 등 모든 도면에 로고 표기. 4부스 이상 대형 참가기업의 노출 강화 옵션.",
    hero: ["https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1600&q=80"],
  },

  // ============ 발송형 ============
  DNL: {
    shortDesc: "국내 뉴스레터 배너 — 약 15만 명 대상.",
    longDesc:
      "국내 참관객 뉴스레터 상단 배너. 2월 1.5M, 3월 3M. 산업 종사자 직접 도달.",
    hero: [
      "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=1600&q=80",
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1600&q=80",
    ],
  },
  INL: {
    shortDesc: "해외 뉴스레터 배너 — 약 3만 명 해외 바이어 대상.",
    longDesc:
      "해외 참관객 뉴스레터 상단 배너. 2월 1.5M, 3월 3M. 글로벌 산업 종사자에게 직접 도달.",
    hero: [
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1600&q=80",
      "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=1600&q=80",
    ],
  },
  APP: {
    shortDesc: "APP 푸시 알림 — 회당 50만원의 직접 도달 매체.",
    longDesc:
      "K-PRINT 공식 어플리케이션 푸시 알림. KIMES 2026에서 진행되는 세미나·이벤트 등 프로그램 홍보 한정. 발송일정 협의.",
    hero: [
      "https://images.unsplash.com/photo-1605457212266-f76f9e07c0fe?w=1600&q=80",
      "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1600&q=80",
    ],
  },

  // ============ APP 디지털 배너 ============
  APM: {
    shortDesc: "APP 메인페이지 팝업 — 앱 진입 시 즉시 노출.",
    longDesc: "공식 어플리케이션 메인 페이지 팝업. 앱을 열 때마다 노출되는 5구좌.",
    hero: [
      "https://images.unsplash.com/photo-1605457212266-f76f9e07c0fe?w=1600&q=80",
      "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1600&q=80",
    ],
  },
  APB: {
    shortDesc: "APP 메인페이지 하단 배너 — 단독 고정 노출.",
    longDesc: "공식 어플리케이션 메인 페이지 하단의 고정 배너. 1개 업체 한정.",
    hero: [
      "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1600&q=80",
      "https://images.unsplash.com/photo-1605457212266-f76f9e07c0fe?w=1600&q=80",
    ],
  },

  // ============ 콘텐츠 ============
  PIC: {
    shortDesc: "참가업체 사전 인터뷰 — 행사 전 SNS 채널로 사전 홍보.",
    longDesc:
      "K-PRINT 공식 인스타그램·페이스북·링크드인·블로그·뉴스레터·카카오 친구톡 송출. 행사 전 참가업체에 직접 방문하여 촬영. 5구좌.",
    hero: [
      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=1600&q=80",
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1600&q=80",
    ],
  },
  OIC: {
    shortDesc: "참가업체 현장 인터뷰 — 행사 현장에서 즉시 콘텐츠 제작.",
    longDesc:
      "전시회 현장에서 촬영. 행사 직후 K-PRINT 공식 SNS 채널로 송출. 5구좌.",
    hero: [
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1600&q=80",
      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=1600&q=80",
    ],
  },
  OCD: {
    shortDesc: "인스타그램 카드뉴스 업로드 — 가벼운 콘텐츠 노출.",
    longDesc:
      "K-PRINT 공식 인스타그램 카드뉴스 업로드. 콘텐츠 품질에 따라 업로드가 제한될 수 있음.",
    hero: [
      "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=1600&q=80",
      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=1600&q=80",
    ],
  },

  // ============ 패키지 (8종) ============
  "PKG-ATOZ": {
    shortDesc: "참관객의 모든 방문 경로에서 기업의 영향력을 알리는 시그니처 패키지.",
    longDesc:
      "등록대 5구좌 + 참관등록 페이지 배너 단독구좌 + 참관객 목걸이를 묶은 패키지. 정가 19.5M → 할인가 17M.",
    hero: [
      "https://images.unsplash.com/photo-1591115765373-5207764f72e4?w=1600&q=80",
      "https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=1600&q=80",
    ],
  },
  "PKG-OUTDOOR": {
    shortDesc: "월평균 120만 명 유동인구 대상 디지털 사이니지 패키지.",
    longDesc:
      "XPACE 브릿지+빅브릿지 + 와이드+스퀘어 + 엣지컬럼 통합 패키지. 정가 24M → 할인가 20M. XPACE 2종만 선택 시 10% 할인.",
    hero: [
      "https://images.unsplash.com/photo-1565035010268-a3816f98589a?w=1600&q=80",
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=80",
    ],
  },
  "PKG-PRIME": {
    shortDesc: "노출에 가장 효과적인 온·오프라인 플랫폼 결합.",
    longDesc:
      "천장배너 + 라이팅월 + 참가업체/전시품 검색 페이지 배너. 정가 9M → 할인가 8M.",
    hero: [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80",
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=1600&q=80",
    ],
  },
  "PKG-EARLY": {
    shortDesc: "국내외 핵심 타깃에게 브랜드를 가장 먼저 각인시키는 패키지.",
    longDesc:
      "참관객 초청 DM + 국내 뉴스레터(2월·3월 각 1회) + 해외 뉴스레터(2월·3월 각 1회). 정가 19M → 할인가 15M.",
    hero: [
      "https://images.unsplash.com/photo-1579208030886-b937da0925dc?w=1600&q=80",
      "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=1600&q=80",
    ],
  },
  "PKG-ONSITE": {
    shortDesc: "전시장 주요 동선을 활용해 기본 노출을 확보하는 실속 패키지.",
    longDesc: "천장배너 + 전시장 내부 바닥 스티커 2구좌. 정가 6M → 할인가 5M.",
    hero: [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80",
    ],
  },
  "PKG-SEMINAR": {
    shortDesc: "의료산업 지식 교류의 장, K-PRINT 세미나 타겟 패키지.",
    longDesc:
      "세미나 페이지 상단 배너 + 앱 푸시 알림 1회 + 국내 뉴스레터(3월 중 1회). 정가 5M → 할인가 4M.",
    hero: [
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&q=80",
      "https://images.unsplash.com/photo-1605457212266-f76f9e07c0fe?w=1600&q=80",
    ],
  },
  "PKG-APP": {
    shortDesc: "K-PRINT 공식 어플리케이션을 활용한 디지털 광고 패키지.",
    longDesc:
      "어플리케이션 메인페이지 팝업 + 하단 배너 + 푸시 알림 2회. 정가 7.5M → 할인가 6M.",
    hero: [
      "https://images.unsplash.com/photo-1605457212266-f76f9e07c0fe?w=1600&q=80",
      "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1600&q=80",
    ],
  },
  "PKG-SNS": {
    shortDesc: "콘텐츠를 활용해 온라인 확산을 유도하는 SNS 패키지.",
    longDesc:
      "참가업체 인터뷰 및 배포(사전·현장) + 인스타그램 카드뉴스. 정가 6.5M → 할인가 5M.",
    hero: [
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1600&q=80",
      "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=1600&q=80",
    ],
  },
};

export type SeedResult = {
  processed: string[]; // 처리된 카테고리 코드 목록
  skipped: string[]; // 카테고리 doc이 없어서 건너뛴 코드 (또는 매핑에 없는 코드)
  errors: Array<{ code: string; reason: string }>;
};

function makeImageItems(urls: string[]): ImageItem[] {
  return urls.map((url, i) => ({
    url,
    storagePath: "", // 외부 URL — Storage에 없음
    caption: "",
    order: i,
  }));
}

function pickHeroMode(type: Category["type"]): ImageSlot["mode"] {
  if (type === "quantity" || type === "print_page") return "gallery";
  if (type === "media") return "single";
  return "carousel";
}

export async function seedSampleImages(): Promise<SeedResult> {
  const db = getDb();
  const result: SeedResult = { processed: [], skipped: [], errors: [] };

  for (const code of Object.keys(SAMPLE_DATA)) {
    const sample = SAMPLE_DATA[code];
    try {
      // 카테고리 조회 (code 기준)
      const catSnap = await getDocs(
        query(collection(db, "categories"), where("code", "==", code))
      );
      if (catSnap.empty) {
        result.skipped.push(code);
        continue;
      }
      const catDoc = catSnap.docs[0];
      const cat = { ...(catDoc.data() as Category), id: catDoc.id };

      // heroImages
      const heroImages: ImageSlot = {
        mode: pickHeroMode(cat.type),
        images: makeImageItems(sample.hero),
      };

      // detailImages
      let detailImages: ImageSlot | undefined;
      if (sample.detail && sample.detail.length > 0) {
        detailImages = {
          mode: "carousel",
          images: makeImageItems(sample.detail),
        };
      }

      // floorImages (floor_plan/xpace만)
      let floorImages: FloorImage[] | undefined;
      if (
        sample.floor &&
        sample.floor.length > 0 &&
        (cat.type === "floor_plan" || cat.type === "xpace")
      ) {
        const subSnap = await getDocs(
          query(
            collection(db, "subcategories"),
            where("categoryId", "==", cat.id)
          )
        );
        const subs = subSnap.docs
          .map((d) => ({ ...(d.data() as Subcategory), id: d.id }))
          .sort((a, b) => a.order - b.order);
        floorImages = subs
          .slice(0, sample.floor.length)
          .map((sub, i) => ({
            subcategoryId: sub.id,
            url: sample.floor![i],
            storagePath: "",
            pins: [],
          }));
      }

      // updateDoc
      const updates: Record<string, unknown> = {
        shortDesc: sample.shortDesc,
        longDesc: sample.longDesc,
        heroImages,
        isPublished: true,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (detailImages) updates.detailImages = detailImages;
      if (floorImages) updates.floorImages = floorImages;

      await updateDoc(doc(db, "categories", cat.id), updates);
      result.processed.push(code);
    } catch (e) {
      result.errors.push({
        code,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
