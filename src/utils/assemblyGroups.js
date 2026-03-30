import {
  createAssemblyId,
  getAssemblyGroupName,
  getAssemblyRoomTypeId,
  getAssemblyRoomTypeName,
  matchesAssemblyRoomType,
  normalizeAssemblies,
} from "./assemblies";

export const defaultAssemblyGroupNames = [
  "Finishes",
  "Waterproofing",
  "Joinery",
  "Fixtures",
  "Services",
  "Walls & Linings",
];

export const assemblyGroupsStorageKey = "estimator.assemblyGroups";

function cleanText(value) {
  return String(value || "").trim();
}

function uniqueSortedGroupNames(values = []) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

export function getStoredAssemblyGroupNames(storage) {
  if (!storage) {
    return [];
  }

  try {
    const savedValue = storage.getItem(assemblyGroupsStorageKey);
    if (!savedValue) {
      return [];
    }

    return uniqueSortedGroupNames(JSON.parse(savedValue));
  } catch (error) {
    return [];
  }
}

export function saveStoredAssemblyGroupNames(groupNames = [], storage) {
  if (!storage) {
    return;
  }

  storage.setItem(
    assemblyGroupsStorageKey,
    JSON.stringify(uniqueSortedGroupNames(groupNames))
  );
}

export function getAssemblyGroupNames(assemblies = [], customGroupNames = []) {
  return uniqueSortedGroupNames([
    ...defaultAssemblyGroupNames,
    ...customGroupNames,
    ...normalizeAssemblies(assemblies).map((assembly) => getAssemblyGroupName(assembly)),
  ]);
}

export function isAssemblyGroupDefined(groupName, assemblies = [], customGroupNames = []) {
  return getAssemblyGroupNames(assemblies, customGroupNames).includes(cleanText(groupName));
}

export function matchesRoomType(roomType, appliesToRoomType, roomTypeId, appliesToRoomTypeId) {
  if (appliesToRoomType === "All" || appliesToRoomTypeId === "all") {
    return true;
  }

  if (roomTypeId && appliesToRoomTypeId) {
    return roomTypeId === appliesToRoomTypeId;
  }

  return appliesToRoomType === roomType;
}

export function getAssemblyGroupId(assemblyRow) {
  return createAssemblyId(assemblyRow);
}

export function getAssemblyGroups(assemblies, roomType, roomTypeId) {
  return normalizeAssemblies(assemblies)
    .filter((assembly) => matchesAssemblyRoomType(assembly, roomType, roomTypeId))
    .map((assembly) => ({
      id: getAssemblyGroupId(assembly),
      assemblyName: assembly.assemblyName,
      assemblyGroup: getAssemblyGroupName(assembly),
      assemblyCategory: getAssemblyGroupName(assembly),
      roomTypeId: getAssemblyRoomTypeId(assembly),
      roomType: getAssemblyRoomTypeName(assembly),
      appliesToRoomTypeId: getAssemblyRoomTypeId(assembly),
      appliesToRoomType: getAssemblyRoomTypeName(assembly),
      itemCount: assembly.items.length,
    }))
    .sort((left, right) =>
    left.assemblyName.localeCompare(right.assemblyName)
    );
}
