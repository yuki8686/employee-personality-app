import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type DepartmentDoc = {
  id: string;
  name?: string;
  parentDepartmentId?: string | null;
  managerUserIds?: string[];
};

export async function getAllDepartments(): Promise<DepartmentDoc[]> {
  const snap = await getDocs(collection(db, "departments"));

  return snap.docs.map((doc) => {
    const data = doc.data() as Omit<DepartmentDoc, "id">;
    return {
      id: doc.id,
      ...data,
    };
  });
}

export async function getDepartmentIdsManagedByUser(
  uid: string
): Promise<string[]> {
  if (!uid) return [];

  const snap = await getDocs(
    query(collection(db, "departments"), where("managerUserIds", "array-contains", uid))
  );

  return snap.docs.map((doc) => doc.id);
}

export function collectDescendantDepartmentIds(
  allDepartments: DepartmentDoc[],
  rootDepartmentIds: string[]
): string[] {
  const result = new Set<string>(rootDepartmentIds);
  let changed = true;

  while (changed) {
    changed = false;

    for (const dept of allDepartments) {
      const parentId = dept.parentDepartmentId || null;
      if (!parentId) continue;

      if (result.has(parentId) && !result.has(dept.id)) {
        result.add(dept.id);
        changed = true;
      }
    }
  }

  return Array.from(result);
}

export async function getManagedDepartmentIdsWithDescendants(
  uid: string
): Promise<string[]> {
  const [allDepartments, rootDepartmentIds] = await Promise.all([
    getAllDepartments(),
    getDepartmentIdsManagedByUser(uid),
  ]);

  return collectDescendantDepartmentIds(allDepartments, rootDepartmentIds);
}