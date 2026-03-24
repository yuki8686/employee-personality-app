"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/home");
        return;
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/home");
    } catch (err) {
      console.error(err);
      setError("ログインに失敗しました。メールアドレスかパスワードを確認してください。");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md p4g-panel p-6">
          <p className="text-lg font-bold">認証状態を確認中...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md p4g-panel p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">ログイン</h1>
        </div>

        <div className="mb-4">
          <label className="p4g-label">メールアドレス</label>
          <input
            className="p4g-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="p4g-label">パスワード</label>
          <input
            className="p4g-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="mb-4 text-sm font-bold text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="p4g-button p4g-button-yellow w-full disabled:opacity-50"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </main>
  );
}