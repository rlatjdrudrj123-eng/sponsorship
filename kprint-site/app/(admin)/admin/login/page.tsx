"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FirebaseError } from "firebase/app";
import { signIn, signOut, onAuthChange, isAdminEmail } from "@/lib/firebase/auth";

const schema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요"),
  password: z.string().min(6, "비밀번호는 6자 이상"),
});
type FormValues = z.infer<typeof schema>;

function authErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "이메일 또는 비밀번호가 올바르지 않습니다.";
      case "auth/too-many-requests":
        return "시도가 너무 많습니다. 잠시 후 다시 시도하세요.";
      case "auth/network-request-failed":
        return "네트워크 오류가 발생했습니다. 연결 상태를 확인하세요.";
      default:
        return `로그인에 실패했습니다. (${err.code})`;
    }
  }
  return "알 수 없는 오류가 발생했습니다.";
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // 이미 로그인 + 관리자라면 바로 /admin 으로
  useEffect(() => {
    return onAuthChange((user) => {
      if (user && isAdminEmail(user.email)) {
        router.replace("/admin");
      }
    });
  }, [router]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      const user = await signIn(values.email, values.password);
      if (!isAdminEmail(user.email)) {
        await signOut();
        setSubmitError("관리자 권한이 없는 계정입니다.");
        return;
      }
      router.replace("/admin");
    } catch (err) {
      setSubmitError(authErrorMessage(err));
    }
  };

  return (
    <main className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-ink-100 rounded-card p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          <span className="font-bold text-ink-900 tracking-tight">K-PRINT Admin</span>
        </div>
        <h1 className="text-xl font-bold text-ink-900 mb-1">로그인</h1>
        <p className="text-sm text-ink-700 mb-6">관리자 계정으로 로그인하세요.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div>
            <label htmlFor="email" className="block text-xs text-ink-700 mb-1">
              이메일
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="admin@kprint.kr"
              {...register("email")}
              className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
            />
            {errors.email && (
              <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-xs text-ink-700 mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500"
            />
            {errors.password && (
              <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
            )}
          </div>

          {submitError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-btn px-3 py-2">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-btn bg-brand-500 text-ink-900 font-semibold transition-colors hover:bg-brand-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "로그인 중…" : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
