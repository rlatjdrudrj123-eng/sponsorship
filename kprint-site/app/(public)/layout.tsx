import type { ReactNode } from "react";
import { CartFloating } from "@/components/public/CartFloating";
import { ThemeProvider } from "@/components/public/ThemeProvider";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <CartFloating />
    </ThemeProvider>
  );
}
