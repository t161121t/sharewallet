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
import { register, ApiClientError } from "@/lib/apiClient";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const validate = () => {
    const newErrors: { name?: string; email?: string; password?: string } = {};
    if (!name.trim()) newErrors.name = "名前を入力してください";
    if (!email.trim()) newErrors.email = "メールアドレスを入力してください";
    if (!password.trim()) newErrors.password = "パスワードを入力してください";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await register(name, email, password);
      toast.success("登録が完了しました。ログインしてください。");
      const redirect = searchParams.get("redirect");
      router.push(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login");
    } catch (e) {
      if (e instanceof ApiClientError) {
        toast.error(e.message);
      } else {
        toast.error("登録に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full flex-1">
      <TextInput
        label="名前"
        type="text"
        placeholder="名前を入力"
        value={name}
        onChange={(v) => {
          setName(v);
          if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
        }}
        error={errors.name}
      />
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
        <PrimaryButton onClick={handleRegister} loading={loading}>
          新規登録
        </PrimaryButton>
      </div>

      <p className="text-center text-base text-[#7a756d] dark:text-[#9e9a93] mt-1">
        <Link
          href="/login"
          className="underline hover:text-[#2d2a26] dark:hover:text-[#eae7e1] transition-colors duration-150"
          aria-label="ログイン画面へ"
        >
          ログインはこちら
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col items-center w-full flex-1">
        <div className="pt-4 pb-8">
          <Logo size={100} showScriptText={true} />
        </div>

        <Suspense fallback={<div className="flex-1" />}>
          <RegisterForm />
        </Suspense>

        <footer className="py-4 flex justify-center mt-auto">
          <CoinIcon size="md" />
        </footer>
      </PageTransition>
    </ScreenContainer>
  );
}
