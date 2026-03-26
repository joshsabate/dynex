function normalizeAssemblyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  if (assemblyRow.assemblyId) {
    return assemblyRow.assemblyId;
  }

  return `assembly-${normalizeAssemblyPart(
    assemblyRow.appliesToRoomTypeId || assemblyRow.appliesToRoomType
  )}-${normalizeAssemblyPart(assemblyRow.assemblyName)}`;
}

export function getAssemblyGroups(assemblyRows, roomType, roomTypeId) {
  const groups = new Map();

  assemblyRows.forEach((assemblyRow) => {
    if (
      (roomType || roomTypeId) &&
      !matchesRoomType(
        roomType,
        assemblyRow.appliesToRoomType,
        roomTypeId,
        assemblyRow.appliesToRoomTypeId
      )
    ) {
      return;
    }

    const groupId = getAssemblyGroupId(assemblyRow);

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,
        assemblyName: assemblyRow.assemblyName,
        assemblyCategory: assemblyRow.assemblyCategory,
        appliesToRoomType: assemblyRow.appliesToRoomType,
      });
    }
  });

  return Array.from(groups.values()).sort((left, right) =>
    left.assemblyName.localeCompare(right.assemblyName)
  );
}
