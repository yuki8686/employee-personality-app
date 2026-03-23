"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type UserItem = {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: string;
  department?: string;
};

export default function FeedbackPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [challenge, setChallenge] = useState("");
  const [impression, setImpression] = useState("");
  const [expectation, setExpectation] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        setCurrentUserId(user.uid);

        // 自分の users ドキュメントを直接読む
        const meDoc = await getDoc(doc(db, "users", user.uid));

        if (!meDoc.exists()) {
          alert("users コレクションにログイン中ユーザーの情報がありません");
          setLoading(false);
          return;
        }

        const meData = meDoc.data();
        setCurrentUserName(meData.name || "");
        setCurrentRole((meData.role || "").trim().toLowerCase());

        // ユーザー一覧を取得
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersList = usersSnapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...(docItem.data() as Omit<UserItem, "id">),
        }));

        setUsers(usersList);
      } catch (error) {
        console.error("初期データ取得エラー:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async () => {
    if (!targetUserId) {
      alert("対象社員を選択してください");
      return;
    }

    if (!challenge || !impression || !expectation || !comment) {
      alert("すべて入力してください");
      return;
    }

    try {
      await addDoc(collection(db, "feedbacks"), {
        targetUserId,
        fromUserId: currentUserId,
        fromUserName: currentUserName,
        challenge,
        impression,
        expectation,
        comment,
        createdAt: new Date().toISOString().slice(0, 10),
      });

      alert("フィードバックを保存しました");

      setTargetUserId("");
      setChallenge("");
      setImpression("");
      setExpectation("");
      setComment("");
    } catch (error) {
      console.error("保存エラー:", error);
      alert("保存に失敗しました");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
          読み込み中...
        </div>
      </main>
    );
  }

  if (currentRole !== "admin" && currentRole !== "manager") {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">フィードバック入力</h1>
          <p className="mb-2">この画面は Admin または Manager のみ利用できます。</p>
          <p className="text-sm text-gray-600">現在の role: {currentRole || "未取得"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-2xl font-bold">フィードバック入力</h1>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold">対象社員</label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="w-full rounded-lg border p-3"
          >
            <option value="">選択してください</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold">現在の課題</label>
          <textarea
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            className="w-full rounded-lg border p-3"
            rows={3}
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold">印象</label>
          <textarea
            value={impression}
            onChange={(e) => setImpression(e.target.value)}
            className="w-full rounded-lg border p-3"
            rows={3}
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold">期待していること</label>
          <textarea
            value={expectation}
            onChange={(e) => setExpectation(e.target.value)}
            className="w-full rounded-lg border p-3"
            rows={3}
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold">自由コメント</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border p-3"
            rows={4}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-yellow-400 px-4 py-2 font-bold"
          >
            保存
          </button>

          <button
            type="button"
            onClick={() => router.push("/home")}
            className="rounded-lg bg-gray-800 px-4 py-2 font-bold text-white"
          >
            ホームへ戻る
          </button>
        </div>
      </div>
    </main>
  );
}