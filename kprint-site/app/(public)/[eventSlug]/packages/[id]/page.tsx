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
import type { Package, SiteSettings, Slot } from "@/lib/types";
import { PackageType } from "@/components/public/CategoryDetail/PackageType";

export default function PackageDetailPage() {
  const params = useParams<{ eventSlug: string; id: string }>();
  const eventId = params.eventSlug;
  const id = params.id;

  const [pkg, setPkg] = useState<Package | null>(null);
  const [resolvedSlots, setResolvedSlots] = useState<Map<string, Slot>>(
    new Map()
  );
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const db = getDb();
        const pkgSnap = await getDoc(doc(db, "packages", id));
        if (!pkgSnap.exists()) {
          setNotFound(true);
          setLoaded(true);
          return;
        }
        const data = { ...(pkgSnap.data() as Package), id: pkgSnap.id };
        setPkg(data);

        const [slotsSnap, settingsSnap] = await Promise.all([
          getDocs(
            query(collection(db, "slots"), where("eventId", "==", eventId))
          ),
          getDoc(doc(db, "siteSettings", eventId)),
        ]);
        const map = new Map<string, Slot>();
        slotsSnap.docs.forEach((d) => {
          map.set(d.id, { ...(d.data() as Slot), id: d.id });
        });
        setResolvedSlots(map);
        if (settingsSnap.exists())
          setSettings(settingsSnap.data() as SiteSettings);
        setLoaded(true);
      } catch (e) {
        console.error(e);
        setLoaded(true);
      }
    })();
  }, [eventId, id]);

  if (!loaded) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-ink-500">
        불러오는 중…
      </div>
    );
  }
  if (notFound || !pkg) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="text-center">
          <p className="text-sm text-ink-700">패키지를 찾을 수 없습니다.</p>
          <Link
            href={`/${eventId}/packages`}
            className="text-mint-700 font-semibold mt-3 inline-block hover:underline"
          >
            전체 패키지로 →
          </Link>
        </div>
      </div>
    );
  }

  return <PackageType pkg={pkg} resolvedSlots={resolvedSlots} settings={settings} />;
}
