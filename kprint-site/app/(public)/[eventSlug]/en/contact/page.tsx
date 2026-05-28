"use client";

import { LocaleSetter } from "@/components/public/LocaleSetter";
import KoPage from "../../contact/page";

export default function Page() {
  return (
    <>
      <LocaleSetter locale="en" />
      <KoPage />
    </>
  );
}
