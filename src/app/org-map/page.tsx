"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function OrgMapPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const userList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(userList);
    };

    fetchUsers();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-4 text-2xl font-bold">組織マップ</h1>

        <div className="grid gap-4">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border p-4">
              <p>名前: {user.name}</p>
              <p>部署: {user.department}</p>
              <p>権限: {user.role}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}