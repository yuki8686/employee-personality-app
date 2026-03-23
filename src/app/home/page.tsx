"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserRole } from "@/utils/role";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        return;
      }

      setUser(firebaseUser);

      try {
        const userRole = await getUserRole(firebaseUser.uid);
        setRole(userRole);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert("ログアウトしました");
      router.push("/login");
    } catch (error) {
      console.error(error);
      alert("ログアウトに失敗しました");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow">
          読み込み中...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-white p-4 shadow">
          <div>
            <h1 className="text-2xl font-bold">ホーム</h1>
            <p className="text-sm text-gray-600">ログイン中: {user?.email}</p>
            <p className="text-sm text-gray-600">権限: {role}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            ログアウト
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <p className="mb-4">ここに診断結果サマリーや相性カードを表示していきます。</p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="rounded-lg bg-yellow-400 px-4 py-2 font-bold"
            >
              プロフィールを見る
            </button>

            <button
              type="button"
              onClick={() => router.push("/org-map")}
              className="rounded-lg bg-gray-800 px-4 py-2 font-bold text-white"
            >
              組織マップ
            </button>

            {(role === "admin" || role === "manager") && (
              <button
                type="button"
                onClick={() => router.push("/feedback")}
                className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white"
              >
                フィードバック入力
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}