"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import { cachedFetch } from "@/lib/firebase/cache";
import type {
  Category,
  SiteSettings,
  Slot,
  Subcategory,
} from "@/lib/types";
import { FloorPlanType } from "@/components/public/CategoryDetail/FloorPlanType";
import { QuantityType } from "@/components/public/CategoryDetail/QuantityType";
import { MediaType } from "@/components/public/CategoryDetail/MediaType";
import { DigitalBannerType } from "@/components/public/CategoryDetail/DigitalBannerType";
import { MailingType } from "@/components/public/CategoryDetail/MailingType";
import { PrintPageType } from "@/components/public/CategoryDetail/PrintPageType";
import { ContentType } from "@/components/public/CategoryDetail/ContentType";
import { XpaceType } from "@/components/public/CategoryDetail/XpaceType";

export default function CategoryDetailPage() {
  const params = useParams<{ slug: string; eventSlug: string }>();
  const slug = params.slug;
  const eventId = params.eventSlug;

  const [category, setCategory] = useState<Category | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!eventId || !slug) return;
    (async () => {
      try {
        const db = getDb();

        // 전체 카테고리 / settings 는 같은 이벤트 안에서 카테고리 페이지마다 동일 →
        // /sponsorships 등 다른 페이지와 같은 key 로 공유 캐싱.
        const [allCatList, settingsData] = await Promise.all([
          cachedFetch(`pub:cat:${eventId}`, async () => {
            const s = await getDocs(
              query(
                collection(db, "categories"),
                where("eventId", "==", eventId),
                where("isPublished", "==", true)
              )
            );
            return s.docs.map((d) => ({ ...(d.data() as Category), id: d.id }));
          }),
          cachedFetch(`pub:settings:${eventId}`, async () => {
            const s = await getDoc(doc(db, "siteSettings", eventId));
            return s.exists() ? (s.data() as SiteSettings) : null;
          }),
        ]);

        const cat = allCatList.find((c) => c.slug === slug);
        if (!cat) {
          setNotFound(true);
          setLoaded(true);
          return;
        }
        setCategory(cat);
        setAllCategories(allCatList);
        if (settingsData) setSettings(settingsData);

        // 이 카테고리에 속한 sub/slot 은 카테고리별 별도 캐시.
        const [subList, slotList] = await Promise.all([
          cachedFetch(`pub:sub:cat:${cat.id}`, async () => {
            const s = await getDocs(
              query(
                collection(db, "subcategories"),
                where("categoryId", "==", cat.id)
              )
            );
            return s.docs.map((d) => ({ ...(d.data() as Subcategory), id: d.id }));
          }),
          cachedFetch(`pub:slot:cat:${cat.id}`, async () => {
            const s = await getDocs(
              query(collection(db, "slots"), where("categoryId", "==", cat.id))
            );
            return s.docs.map((d) => ({ ...(d.data() as Slot), id: d.id }));
          }),
        ]);
        setSubcategories(subList);
        setSlots(slotList);
        setLoaded(true);
      } catch (e) {
        console.error(e);
        setLoaded(true);
      }
    })();
  }, [slug, eventId]);

  if (!loaded) {
    return <div className="min-h-screen grid place-items-center text-sm text-ink-500">불러오는 중…</div>;
  }
  if (notFound || !category) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="text-center">
          <p className="text-sm text-ink-700">카테고리를 찾을 수 없습니다.</p>
          <Link
            href={`/${eventId}/sponsorships`}
            className="text-brand-700 font-semibold mt-3 inline-block hover:underline"
          >
            전체 보기로 →
          </Link>
        </div>
      </div>
    );
  }

  const props = {
    category,
    subcategories,
    slots,
    allCategories,
    settings,
  };

  switch (category.type) {
    case "floor_plan":
      return <FloorPlanType {...props} />;
    case "quantity":
      return <QuantityType {...props} />;
    case "media":
      return <MediaType {...props} />;
    case "digital_banner":
      return <DigitalBannerType {...props} />;
    case "mailing":
      return <MailingType {...props} />;
    case "print_page":
      return <PrintPageType {...props} />;
    case "content":
      return <ContentType {...props} />;
    case "xpace":
      return <XpaceType {...props} />;
    case "package":
      // package 타입 카테고리는 없어야 하지만 fallback
      return <QuantityType {...props} />;
    default:
      return <QuantityType {...props} />;
  }
}
