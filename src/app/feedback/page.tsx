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
import AppShell from "@/components/AppShell";

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

        const meDoc = await getDoc(doc(db, "users", user.uid));

        if (!meDoc.exists()) {
          alert("users コレクションにログイン中ユーザーの情報がありません");
          setLoading(false);
          return;
        }

        const meData = meDoc.data();
        setCurrentUserName(meData.name || "");
        setCurrentRole((meData.role || "").trim().toLowerCase());

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
      <AppShell title="フィードバック入力">
        <div className="p4g-card">読み込み中...</div>
      </AppShell>
    );
  }

  if (currentRole !== "admin" && currentRole !== "manager") {
    return (
      <AppShell title="フィードバック入力" role={currentRole}>
        <div className="p4g-card">
          この画面は Admin または Manager のみ利用できます。
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="フィードバック入力" role={currentRole}>
      <div className="p4g-card">
        <div className="mb-4">
          <label className="p4g-label">対象社員</label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="p4g-select"
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
          <label className="p4g-label">現在の課題</label>
          <textarea
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            className="p4g-textarea"
            rows={3}
          />
        </div>

        <div className="mb-4">
          <label className="p4g-label">印象</label>
          <textarea
            value={impression}
            onChange={(e) => setImpression(e.target.value)}
            className="p4g-textarea"
            rows={3}
          />
        </div>

        <div className="mb-4">
          <label className="p4g-label">期待していること</label>
          <textarea
            value={expectation}
            onChange={(e) => setExpectation(e.target.value)}
            className="p4g-textarea"
            rows={3}
          />
        </div>

        <div className="mb-6">
          <label className="p4g-label">自由コメント</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="p4g-textarea"
            rows={4}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            className="p4g-button p4g-button-yellow"
          >
            保存
          </button>

          <button
            type="button"
            onClick={() => router.push("/home")}
            className="p4g-button p4g-button-dark"
          >
            ホームへ戻る
          </button>
        </div>
      </div>
    </AppShell>
  );
}