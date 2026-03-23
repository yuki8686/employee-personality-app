"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      await signInWithEmailAndPassword(auth, email, password);

      alert("ログイン成功");
      router.push("/home");
    } catch (err) {
      console.error(err);
      setError("ログインに失敗しました。メールアドレスかパスワードを確認してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-yellow-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-6">ログイン</h1>

        <div className="mb-4">
          <label className="block mb-2 text-sm">メールアドレス</label>
          <input
            className="w-full rounded-lg border p-3"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2 text-sm">パスワード</label>
          <input
            className="w-full rounded-lg border p-3"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-lg bg-yellow-400 py-3 font-bold disabled:opacity-50"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </main>
  );
}