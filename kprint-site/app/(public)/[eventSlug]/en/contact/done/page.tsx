"use client";

import { LocaleSetter } from "@/components/public/LocaleSetter";
import KoPage from "../../../contact/done/page";

export default function Page() {
  return (
    <>
      <LocaleSetter locale="en" />
      <KoPage />
    </>
  );
}
