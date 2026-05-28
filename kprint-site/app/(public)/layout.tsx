import type { ReactNode } from "react";
import { CartFloating } from "@/components/public/CartFloating";
import { ThemeProvider } from "@/components/public/ThemeProvider";
import { LocaleSetter } from "@/components/public/LocaleSetter";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleSetter />
      {children}
      <CartFloating />
    </ThemeProvider>
  );
}
