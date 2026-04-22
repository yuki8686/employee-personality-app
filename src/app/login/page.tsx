"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/home");
    } catch (e) {
      console.error(e);
      setError("ログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveResetPassword = () => {
    router.push("/reset-password");
  };

  return (
    <main className="p4g-shell flex min-h-screen items-center justify-center px-4 text-white">
      <div className="w-full max-w-md">
        <div className="rounded-[28px] border-[4px] border-black bg-[#171717] p-6 shadow-[0_10px_0_#000]">
          <div className="text-center">
            <div className="inline-block rounded-full border-[3px] border-black bg-[#f3c400] px-4 py-1 text-xs font-black text-black shadow-[0_4px_0_#000]">
              LOGIN
            </div>

            <h1 className="mt-4 text-3xl font-black">アカウントにログイン</h1>

            <p className="mt-2 text-sm text-white/70">
              メールアドレスとパスワードを入力してください
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[16px] border-[3px] border-black bg-[#f6f0d8] px-4 py-3 text-sm font-bold text-black outline-none"
            />

            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[16px] border-[3px] border-black bg-[#f6f0d8] px-4 py-3 text-sm font-bold text-black outline-none"
            />

            {error && (
              <div className="rounded-[16px] border-[3px] border-black bg-[#ffd0d0] px-4 py-3 text-sm font-black text-[#7b1111]">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-[16px] border-[3px] border-black bg-[#f3c400] px-5 py-3 text-sm font-black text-black shadow-[0_6px_0_#000] transition-all hover:-translate-y-0.5 hover:bg-[#ffe15a] hover:shadow-[0_8px_0_#000] disabled:opacity-50"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>

            <button
              type="button"
              onClick={handleMoveResetPassword}
              className="w-full rounded-[16px] border-[3px] border-black bg-[#111111] px-5 py-3 text-sm font-black text-white shadow-[0_6px_0_#000] transition-all hover:-translate-y-0.5 hover:bg-[#1d1d1d] hover:shadow-[0_8px_0_#000]"
            >
              パスワードを忘れた場合
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}