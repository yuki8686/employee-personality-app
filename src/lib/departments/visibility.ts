import {
  collection,
  getDocs,
  query,
  where,
  type Firestore,
} from "firebase/firestore";

export type DepartmentDoc = {
  id: string;
  name?: string;
  parentDepartmentId?: string;
  managerUserIds?: string[];
};

export async function getManagerVisibleDepartmentNames(
  db: Firestore,
  managerUid: string
): Promise<string[]> {
  const departmentsSnap = await getDocs(collection(db, "departments"));

  const departments: DepartmentDoc[] = departmentsSnap.docs.map((doc) => {
    const data = doc.data() as Omit<DepartmentDoc, "id">;
    return {
      id: doc.id,
      name: data.name || "",
      parentDepartmentId: data.parentDepartmentId || "",
      managerUserIds: Array.isArray(data.managerUserIds) ? data.managerUserIds : [],
    };
  });

  const managedRoots = departments.filter((department) =>
    (department.managerUserIds || []).includes(managerUid)
  );

  if (managedRoots.length === 0) {
    return [];
  }

  const childrenByParentId = new Map<string, DepartmentDoc[]>();

  for (const department of departments) {
    const parentId = department.parentDepartmentId || "";
    if (!childrenByParentId.has(parentId)) {
      childrenByParentId.set(parentId, []);
    }
    childrenByParentId.get(parentId)!.push(department);
  }

  const visited = new Set<string>();
  const visibleDepartmentNames = new Set<string>();
  const queue: DepartmentDoc[] = [...managedRoots];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (visited.has(current.id)) continue;

    visited.add(current.id);

    if ((current.name || "").trim() !== "") {
      visibleDepartmentNames.add(current.name!.trim());
    }

    const children = childrenByParentId.get(current.id) || [];
    for (const child of children) {
      if (!visited.has(child.id)) {
        queue.push(child);
      }
    }
  }

  return Array.from(visibleDepartmentNames);
}

export async function getUsersInDepartmentNames(
  db: Firestore,
  departmentNames: string[]
) {
  if (departmentNames.length === 0) {
    return [];
  }

  const uniqueNames = Array.from(
    new Set(departmentNames.map((name) => name.trim()).filter(Boolean))
  );

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueNames.length; i += 10) {
    chunks.push(uniqueNames.slice(i, i + 10));
  }

  const allDocs: Awaited<ReturnType<typeof getDocs>>["docs"] = [];

  for (const names of chunks) {
    const usersSnap = await getDocs(
      query(collection(db, "users"), where("departmentName", "in", names))
    );
    allDocs.push(...usersSnap.docs);
  }

  const deduped = new Map<string, (typeof allDocs)[number]>();
  for (const doc of allDocs) {
    deduped.set(doc.id, doc);
  }

  return Array.from(deduped.values());
}