import {
  createAssemblyId,
  getAssemblyGroupName,
  getAssemblyRoomTypeId,
  getAssemblyRoomTypeName,
  matchesAssemblyRoomType,
  normalizeAssemblies,
} from "./assemblies";

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
