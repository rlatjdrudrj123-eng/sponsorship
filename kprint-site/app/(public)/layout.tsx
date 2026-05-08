import type { ReactNode } from "react";
import { CartFloating } from "@/components/public/CartFloating";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CartFloating />
    </>
  );
}
