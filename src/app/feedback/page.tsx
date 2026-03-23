"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function FeedbackPage() {
  const [targetUserId, setTargetUserId] = useState("");
  const [challenge, setChallenge] = useState("");
  const [impression, setImpression] = useState("");
  const [expectation, setExpectation] = useState("");
  const [comment, setComment] = useState("");

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, "feedbacks"), {
      targetUserId,
      authorUserId: user.uid,
      challenge,
      impression,
      expectation,
      comment,
      createdAt: serverTimestamp(),
    });

    alert("保存しました");
    setTargetUserId("");
    setChallenge("");
    setImpression("");
    setExpectation("");
    setComment("");
  };

  return (
    <main className="min-h-screen p-6 bg-neutral-100">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-2xl font-bold">フィードバック入力</h1>

        <input
          className="mb-3 w-full rounded border p-3"
          placeholder="対象社員ID"
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
        />
        <textarea
          className="mb-3 w-full rounded border p-3"
          placeholder="現在の課題"
          value={challenge}
          onChange={(e) => setChallenge(e.target.value)}
        />
        <textarea
          className="mb-3 w-full rounded border p-3"
          placeholder="印象"
          value={impression}
          onChange={(e) => setImpression(e.target.value)}
        />
        <textarea
          className="mb-3 w-full rounded border p-3"
          placeholder="期待していること"
          value={expectation}
          onChange={(e) => setExpectation(e.target.value)}
        />
        <textarea
          className="mb-4 w-full rounded border p-3"
          placeholder="自由記述"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          className="rounded-lg bg-yellow-400 px-4 py-2 font-bold"
        >
          保存
        </button>
      </div>
    </main>
  );
}