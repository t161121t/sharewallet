"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import Logo from "@/components/ui/Logo";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import CoinIcon from "@/components/ui/CoinIcon";
import { login, ApiClientError } from "@/lib/apiClient";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = "メールアドレスを入力してください";
    if (!password.trim()) newErrors.password = "パスワードを入力してください";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await login(email, password);
      toast.success("ログインしました");
      const redirect = searchParams.get("redirect");
      router.push(redirect ?? "/dashboard");
    } catch (e) {
      if (e instanceof ApiClientError) {
        toast.error(e.message);
      } else {
        toast.error("ログインに失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full flex-1">
      <TextInput
        label="メールアドレス"
        type="text"
        placeholder="example@example.com"
        value={email}
        onChange={(v) => {
          setEmail(v);
          if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
        }}
        error={errors.email}
      />
      <TextInput
        label="パスワード"
        type="password"
        placeholder="パスワードを入力"
        value={password}
        onChange={(v) => {
          setPassword(v);
          if (errors.password)
            setErrors((e) => ({ ...e, password: undefined }));
        }}
        error={errors.password}
      />

      <div className="pt-2">
        <PrimaryButton onClick={handleLogin} loading={loading}>
          ログイン
        </PrimaryButton>
      </div>

      <p className="text-center text-base text-[#7a756d] dark:text-[#9e9a93] mt-1">
        <Link
          href="/register"
          className="underline hover:text-[#2d2a26] dark:hover:text-[#eae7e1] transition-colors duration-150"
          aria-label="新規登録画面へ"
        >
          新規登録はこちら
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col items-center w-full flex-1">
        <div className="pt-4 pb-8">
          <Logo size={100} showScriptText={true} />
        </div>

        <Suspense fallback={<div className="flex-1" />}>
          <LoginForm />
        </Suspense>

        <footer className="py-4 flex justify-center mt-auto">
          <CoinIcon size="md" />
        </footer>
      </PageTransition>
    </ScreenContainer>
  );
}
