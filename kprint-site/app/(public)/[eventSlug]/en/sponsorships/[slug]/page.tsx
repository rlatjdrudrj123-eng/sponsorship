"use client";

import { LocaleSetter } from "@/components/public/LocaleSetter";
import KoPage from "../../../sponsorships/[slug]/page";

export default function Page() {
  return (
    <>
      <LocaleSetter locale="en" />
      <KoPage />
    </>
  );
}
