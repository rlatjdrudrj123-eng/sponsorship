"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FirebaseError } from "firebase/app";
import { onAuthChange, resetPassword, signIn, signUp } from "@/lib/firebase/auth";

type Tab = "login" | "signup" | "reset";

const loginSchema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요"),
  password: z.string().min(6, "비밀번호는 6자 이상"),
});
const signupSchema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력하세요").max(50, "50자 이내"),
    email: z.string().email("올바른 이메일을 입력하세요"),
    password: z.string().min(8, "비밀번호는 8자 이상"),
    password2: z.string(),
  })
  .refine((v) => v.password === v.password2, {
    path: ["password2"],
    message: "비밀번호가 서로 다릅니다",
  });
const resetSchema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요"),
});

function authErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "이메일 또는 비밀번호가 올바르지 않습니다.";
      case "auth/email-already-in-use":
        return "이미 가입된 이메일입니다. 로그인 탭에서 로그인하세요.";
      case "auth/weak-password":
        return "비밀번호가 너무 단순합니다. 8자 이상으로 정해 주세요.";
      case "auth/invalid-email":
        return "이메일 형식이 올바르지 않습니다.";
      case "auth/operation-not-allowed":
        return "현재 가입 기능이 꺼져 있습니다. 관리자에게 문의하세요.";
      case "auth/too-many-requests":
        return "시도가 너무 많습니다. 잠시 후 다시 시도하세요.";
      case "auth/network-request-failed":
        return "네트워크 오류가 발생했습니다. 연결 상태를 확인하세요.";
      default:
        return `처리에 실패했습니다. (${err.code})`;
    }
  }
  return err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [notice, setNotice] = useState<string | null>(null);

  // 이미 로그인돼 있으면 /admin 으로 — 권한 상태(승인 대기 등)는 어드민 레이아웃이 안내
  useEffect(() => {
    return onAuthChange((user) => {
      if (user) router.replace("/admin");
    });
  }, [router]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setNotice(null);
  };

  return (
    <main className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-ink-100 rounded-card p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          <span className="font-bold text-ink-900 tracking-tight">스폰서십 관리</span>
        </div>

        <div role="tablist" className="grid grid-cols-3 gap-1 bg-ink-50 rounded-btn p-1 mb-6">
          {(
            [
              ["login", "로그인"],
              ["signup", "사용 신청"],
              ["reset", "비밀번호 찾기"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              className={
                "py-1.5 rounded text-[12.5px] font-semibold transition-colors " +
                (tab === t ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900")
              }
            >
              {label}
            </button>
          ))}
        </div>

        {notice ? (
          <div className="space-y-4">
            <p role="status" className="text-sm text-ink-700 leading-relaxed break-keep">
              {notice}
            </p>
            <button
              type="button"
              onClick={() => (tab === "signup" ? router.replace("/admin") : switchTab("login"))}
              className="w-full py-2 rounded-btn bg-brand-500 text-white font-semibold hover:bg-brand-700"
            >
              {tab === "signup" ? "계속" : "로그인으로"}
            </button>
          </div>
        ) : tab === "login" ? (
          <LoginForm onDone={() => router.replace("/admin")} />
        ) : tab === "signup" ? (
          <SignupForm
            onDone={(email) =>
              setNotice(
                `${email} 로 인증 메일을 보냈습니다. 메일의 링크를 누른 뒤 [계속]을 누르면 사용 신청이 접수됩니다. 관리자가 승인하면서 담당 전시회를 배정하면 사용할 수 있습니다.`
              )
            }
          />
        ) : (
          <ResetForm
            onDone={(email) =>
              setNotice(
                `${email} 로 비밀번호 재설정 메일을 보냈습니다. 메일의 링크에서 새 비밀번호를 정한 뒤 로그인하세요.`
              )
            }
          />
        )}
      </div>
    </main>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-ink-100 rounded-btn focus:outline-none focus:border-brand-500";
const submitCls =
  "w-full py-2 rounded-btn bg-brand-500 text-white font-semibold transition-colors hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed";

function FieldBox({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-ink-700 mb-1">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-btn px-3 py-2"
    >
      {message}
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (v: z.infer<typeof loginSchema>) => {
    setSubmitError(null);
    try {
      await signIn(v.email, v.password);
      onDone();
    } catch (err) {
      setSubmitError(authErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <FieldBox id="login-email" label="이메일" error={errors.email?.message}>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
          className={inputCls}
        />
      </FieldBox>
      <FieldBox id="login-password" label="비밀번호" error={errors.password?.message}>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
          className={inputCls}
        />
      </FieldBox>
      <SubmitError message={submitError} />
      <button type="submit" disabled={isSubmitting} className={submitCls}>
        {isSubmitting ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: (email: string) => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", password2: "" },
  });

  const onSubmit = async (v: z.infer<typeof signupSchema>) => {
    setSubmitError(null);
    try {
      // 계정 생성 + 인증 메일 발송까지만. 사용 신청서(members 문서)는 보안 규칙상
      // 메일 인증 뒤에만 만들 수 있어, 인증 후 첫 접속 때 AccountGate 가 이 이름으로 접수한다.
      const user = await signUp(v.name.trim(), v.email, v.password);
      onDone(user.email ?? v.email);
    } catch (err) {
      setSubmitError(authErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <p className="text-[12px] text-ink-500 leading-relaxed break-keep -mt-1 mb-1">
        회사 메일로 신청하세요. 메일 인증 후 관리자가 승인하면 담당 전시회를 쓸 수 있습니다.
      </p>
      <FieldBox id="su-name" label="이름" error={errors.name?.message}>
        <input
          id="su-name"
          autoComplete="name"
          aria-invalid={!!errors.name}
          {...register("name")}
          className={inputCls}
        />
      </FieldBox>
      <FieldBox id="su-email" label="회사 이메일" error={errors.email?.message}>
        <input
          id="su-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
          className={inputCls}
        />
      </FieldBox>
      <FieldBox id="su-pw" label="비밀번호 (8자 이상)" error={errors.password?.message}>
        <input
          id="su-pw"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
          className={inputCls}
        />
      </FieldBox>
      <FieldBox id="su-pw2" label="비밀번호 확인" error={errors.password2?.message}>
        <input
          id="su-pw2"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password2}
          {...register("password2")}
          className={inputCls}
        />
      </FieldBox>
      <SubmitError message={submitError} />
      <button type="submit" disabled={isSubmitting} className={submitCls}>
        {isSubmitting ? "신청 중…" : "사용 신청"}
      </button>
    </form>
  );
}

function ResetForm({ onDone }: { onDone: (email: string) => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (v: z.infer<typeof resetSchema>) => {
    setSubmitError(null);
    try {
      await resetPassword(v.email);
      onDone(v.email);
    } catch (err) {
      setSubmitError(authErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <FieldBox id="rs-email" label="가입한 이메일" error={errors.email?.message}>
        <input
          id="rs-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
          className={inputCls}
        />
      </FieldBox>
      <SubmitError message={submitError} />
      <button type="submit" disabled={isSubmitting} className={submitCls}>
        {isSubmitting ? "보내는 중…" : "재설정 메일 받기"}
      </button>
    </form>
  );
}
