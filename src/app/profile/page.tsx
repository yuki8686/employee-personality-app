"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import ImageUploader from "@/components/ImageUploader";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [compatibility, setCompatibility] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setProfile(userDoc.data());
      }

      const diagnosticDoc = await getDoc(doc(db, "diagnostics", user.uid));
      if (diagnosticDoc.exists()) {
        setDiagnostic(diagnosticDoc.data());
      }

      const compatibilityDoc = await getDoc(doc(db, "compatibilities", user.uid));
      if (compatibilityDoc.exists()) {
        setCompatibility(compatibilityDoc.data());
      }
    });

    return () => unsubscribe();
  }, []);

  const handleImageUpload = async (url: string) => {
    const user = auth.currentUser;
    if (!user) return;

    await updateDoc(doc(db, "users", user.uid), {
      profileImageUrl: url,
    });

    setProfile((prev: any) => ({
      ...prev,
      profileImageUrl: url,
    }));
  };

  return (
    <main className="min-h-screen bg-yellow-50 p-6">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-6 text-2xl font-bold">プロフィール</h1>

        {profile?.profileImageUrl && (
          <img
            src={profile.profileImageUrl}
            alt="profile"
            className="mb-4 h-32 w-32 rounded-full object-cover"
          />
        )}

        <ImageUploader onUpload={handleImageUpload} />

        {profile && (
          <div className="mb-6 mt-6">
            <p>名前: {profile.name}</p>
            <p>メール: {profile.email}</p>
            <p>部署: {profile.department}</p>
            <p>権限: {profile.role}</p>
          </div>
        )}

        {diagnostic && (
          <div className="mb-6 rounded-xl border p-4">
            <p>MBTI: {diagnostic.mbti}</p>
            <p>ビジネス人格: {diagnostic.businessCode}</p>
            <p>信頼度: {diagnostic.confidence}%</p>
            <p>診断日: {diagnostic.diagnosedAt}</p>
          </div>
        )}

        {compatibility && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-xl font-bold">相性が良い社員</h2>
              {compatibility.goodMatches?.map((person: any) => (
                <div key={person.userId} className="mb-2 rounded border p-3">
                  <p>名前: {person.name}</p>
                  <p>
                    {person.mbti} × {person.businessCode}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <h2 className="mb-3 text-xl font-bold">衝突の可能性がある社員</h2>
              {compatibility.conflictMatches?.map((person: any) => (
                <div key={person.userId} className="mb-2 rounded border p-3">
                  <p>名前: 非表示</p>
                  <p>
                    {person.mbti} × {person.businessCode}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}