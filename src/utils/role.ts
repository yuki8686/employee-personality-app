import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function getUserRole(uid: string) {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error("ユーザー情報が存在しません");
  }

  return (docSnap.data().role || "").trim().toLowerCase();
}