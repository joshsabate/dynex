import { hasSupabaseCredentials, supabase } from "./supabase";

function cleanText(value) {
  return String(value || "").trim();
}

function chunkItems(items = [], size = 100) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toText(value) {
  return String(value || "").trim();
}

export function mapCostItemToSupabaseRow(cost) {
  return {
    id: cost.id || undefined,
    internal_id: cost.internalId || null,
    item_name: cost.itemName || "",
    core_name: cost.coreName || "",
    item_type: cost.costType || "",
    work_type: cost.workType || cost.deliveryType || "",
    delivery_type: cost.deliveryType || "",
    item_family: cost.itemFamily || cost.family || "",
    trade_id: cost.tradeId || null,
    trade: cost.trade || "",
    cost_code_id: cost.costCodeId || null,
    cost_code: cost.costCode || "",
    specification: cost.specification || cost.spec || "",
    grade_or_quality: cost.gradeOrQuality || cost.grade || "",
    finish_or_variant: cost.finishOrVariant || cost.finish || "",
    brand: cost.brand || "",
    unit_id: cost.unitId || null,
    unit: cost.unit || "",
    unit_cost:
      cost.rate === "" || cost.rate === null || cost.rate === undefined
        ? 0
        : Number(cost.rate),
    image_url: cost.imageUrl || "",
    status: cost.status || (cost.isActive === false ? "Inactive" : "Active"),
    is_active: cost.isActive !== false,
    internal_note: cost.notes || "",
    source_link: cost.sourceLink || "",
    labour_hours_per_unit:
      cost.labourHoursPerUnit === "" ||
      cost.labourHoursPerUnit === null ||
      cost.labourHoursPerUnit === undefined
        ? null
        : Number(cost.labourHoursPerUnit),
    is_taxable: cost.isTaxable ?? true,
    is_optional: cost.isOptional ?? false,
    sort_order: cost.sortOrder ?? 0,
    description: cost.notes || "",
    cost_data: {
      ...cost,
      status: cost.status || (cost.isActive === false ? "Inactive" : "Active"),
      isActive: cost.isActive !== false,
    },
  };
}

export function mapSupabaseCostRowToItem(row) {
  const payload = row.cost_data || {};
  const isActive = row.is_active ?? payload.isActive ?? true;

  return {
    ...payload,
    id: row.id ?? payload.id ?? "",
    internalId: row.internal_id ?? payload.internalId ?? row.id ?? "",
    itemName: row.item_name ?? payload.itemName ?? "",
    coreName:
      row.core_name ??
      payload.coreName ??
      row.item_name ??
      payload.itemName ??
      "",
    costType: row.item_type ?? payload.costType ?? "",
    deliveryType:
      row.delivery_type ??
      payload.deliveryType ??
      row.work_type ??
      payload.workType ??
      "",
    workType:
      row.work_type ??
      payload.workType ??
      row.delivery_type ??
      payload.deliveryType ??
      "",
    itemFamily: row.item_family ?? payload.itemFamily ?? payload.family ?? "",
    family: row.item_family ?? payload.family ?? payload.itemFamily ?? "",
    tradeId: row.trade_id ?? payload.tradeId ?? "",
    trade: row.trade ?? payload.trade ?? "",
    costCodeId: row.cost_code_id ?? payload.costCodeId ?? "",
    costCode: row.cost_code ?? payload.costCode ?? "",
    specification: row.specification ?? payload.specification ?? payload.spec ?? "",
    spec: row.specification ?? payload.spec ?? payload.specification ?? "",
    gradeOrQuality:
      row.grade_or_quality ?? payload.gradeOrQuality ?? payload.grade ?? "",
    grade: row.grade_or_quality ?? payload.grade ?? payload.gradeOrQuality ?? "",
    finishOrVariant:
      row.finish_or_variant ?? payload.finishOrVariant ?? payload.finish ?? "",
    finish: row.finish_or_variant ?? payload.finish ?? payload.finishOrVariant ?? "",
    brand: row.brand ?? payload.brand ?? "",
    unitId: row.unit_id ?? payload.unitId ?? "",
    unit: row.unit ?? payload.unit ?? "",
    rate: row.unit_cost ?? payload.rate ?? "",
    imageUrl: row.image_url ?? payload.imageUrl ?? "",
    status: row.status ?? payload.status ?? (isActive === false ? "Inactive" : "Active"),
    isActive,
    notes:
      row.internal_note ??
      payload.notes ??
      row.description ??
      "",
    sourceLink: row.source_link ?? payload.sourceLink ?? "",
    labourHoursPerUnit:
      row.labour_hours_per_unit ?? payload.labourHoursPerUnit ?? "",
    isTaxable: row.is_taxable ?? payload.isTaxable ?? true,
    isOptional: row.is_optional ?? payload.isOptional ?? false,
    sortOrder: row.sort_order ?? payload.sortOrder ?? 0,
  };
}

export function mapAssemblyToSupabaseRow(assembly) {
  return {
    id: assembly.id,
    assembly_name: assembly.assemblyName || "",
    room_type_id: assembly.roomTypeId || assembly.appliesToRoomTypeId || "",
    room_type: assembly.roomType || assembly.appliesToRoomType || "",
    assembly_group: assembly.assemblyGroup || assembly.assemblyCategory || "",
    assembly_element: assembly.assemblyElement || "",
    assembly_scope: assembly.assemblyScope || "",
    assembly_spec: assembly.assemblySpec || "",
    image_url: assembly.imageUrl || "",
    notes: assembly.notes || "",
    sort_order:
      assembly.sortOrder === "" || assembly.sortOrder == null
        ? 0
        : Number(assembly.sortOrder),
    is_active: assembly.isActive !== false,
    assembly_data: assembly,
  };
}

export function mapAssemblyItemToSupabaseRow(item, assemblyId, index = 0) {
  const itemId = item.id || `${assemblyId}-item-${index + 1}`;
  return {
    id: itemId,
    assembly_id: assemblyId,
    line_name: item.itemNameSnapshot || item.itemName || "",
    cost_item_id: item.libraryItemId || item.costItemId || "",
    cost_item_name: item.itemNameSnapshot || item.itemName || "",
    quantity_formula: item.quantityFormula || "",
    qty_rule: item.qtyRule || item.quantityFormula || "",
    waste_factor: toNullableNumber(item.wasteFactor),
    unit_override: item.unitOverride || "",
    rate_override: toNullableNumber(item.rateOverride),
    trade_source: item.tradeSource || "inherit",
    trade_id: item.tradeId || "",
    cost_code_source: item.costCodeSource || "inherit",
    cost_code_id: item.costCodeId || "",
    unit_source: item.unitSource || "inherit",
    notes: item.notes || "",
    sort_order:
      item.sortOrder === "" || item.sortOrder == null ? index : Number(item.sortOrder),
    is_active: item.isActive !== false,
    item_data: {
      ...item,
      id: itemId,
      assemblyId,
    },
  };
}

export function mapAssemblyItemRowToItem(row) {
  const payload = row.item_data || {};

  return {
    ...payload,
    id: row.id ?? payload.id ?? "",
    assemblyId: row.assembly_id ?? payload.assemblyId ?? "",
    libraryItemId: row.cost_item_id ?? payload.libraryItemId ?? payload.costItemId ?? "",
    costItemId: row.cost_item_id ?? payload.costItemId ?? payload.libraryItemId ?? "",
    itemNameSnapshot:
      row.line_name ?? row.cost_item_name ?? payload.itemNameSnapshot ?? payload.itemName ?? "",
    itemName:
      row.line_name ?? row.cost_item_name ?? payload.itemName ?? payload.itemNameSnapshot ?? "",
    quantityFormula:
      row.quantity_formula ?? payload.quantityFormula ?? payload.qtyRule ?? "",
    qtyRule: row.qty_rule ?? payload.qtyRule ?? payload.quantityFormula ?? "",
    wasteFactor: row.waste_factor ?? payload.wasteFactor ?? "",
    unitOverride: row.unit_override ?? payload.unitOverride ?? "",
    rateOverride: row.rate_override ?? payload.rateOverride ?? "",
    tradeSource: row.trade_source ?? payload.tradeSource ?? "inherit",
    tradeId: row.trade_id ?? payload.tradeId ?? "",
    costCodeSource: row.cost_code_source ?? payload.costCodeSource ?? "inherit",
    costCodeId: row.cost_code_id ?? payload.costCodeId ?? "",
    unitSource: row.unit_source ?? payload.unitSource ?? "inherit",
    notes: row.notes ?? payload.notes ?? "",
    sortOrder: row.sort_order ?? payload.sortOrder ?? 0,
    isActive: row.is_active ?? payload.isActive ?? true,
  };
}

export function mapAssemblyRowToItem(row, childRows = []) {
  const payload = row.assembly_data || {};

  return {
    ...payload,
    id: row.id ?? payload.id ?? "",
    assemblyName: row.assembly_name ?? payload.assemblyName ?? "",
    roomTypeId:
      row.room_type_id ?? payload.roomTypeId ?? payload.appliesToRoomTypeId ?? "",
    roomType: row.room_type ?? payload.roomType ?? payload.appliesToRoomType ?? "",
    appliesToRoomTypeId:
      row.room_type_id ?? payload.appliesToRoomTypeId ?? payload.roomTypeId ?? "",
    appliesToRoomType:
      row.room_type ?? payload.appliesToRoomType ?? payload.roomType ?? "",
    assemblyGroup: row.assembly_group ?? payload.assemblyGroup ?? payload.assemblyCategory ?? "",
    assemblyCategory:
      row.assembly_group ?? payload.assemblyCategory ?? payload.assemblyGroup ?? "",
    assemblyElement: row.assembly_element ?? payload.assemblyElement ?? "",
    assemblyScope: row.assembly_scope ?? payload.assemblyScope ?? "",
    assemblySpec: row.assembly_spec ?? payload.assemblySpec ?? "",
    imageUrl: row.image_url ?? payload.imageUrl ?? "",
    notes: row.notes ?? payload.notes ?? "",
    sortOrder: row.sort_order ?? payload.sortOrder ?? 0,
    isActive: row.is_active ?? payload.isActive ?? true,
    items: childRows.length
      ? childRows.map(mapAssemblyItemRowToItem)
      : Array.isArray(payload.items)
        ? payload.items
        : [],
  };
}

const libraryConfigs = {
  units: {
    table: "units",
    orderBy: ["sort_order", "name"],
    mapItemToRow: (unit) => ({
      id: unit.id,
      name: unit.name || "",
      abbreviation: unit.abbreviation || "",
      sort_order: Number(unit.sortOrder || 0),
      is_active: unit.isActive !== false,
    }),
    mapRowToItem: (row) => ({
      id: row.id ?? "",
      name: row.name ?? "",
      abbreviation: row.abbreviation ?? "",
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== false,
    }),
  },
  trades: {
    table: "trades",
    orderBy: ["sort_order", "name"],
    mapItemToRow: (trade) => ({
      id: trade.id,
      name: trade.name || "",
      description: trade.description || "",
      status: trade.status || (trade.isActive === false ? "Inactive" : "Active"),
      sort_order: Number(trade.sortOrder || 0),
      is_active: trade.isActive !== false,
    }),
    mapRowToItem: (row) => ({
      id: row.id ?? "",
      name: row.name ?? "",
      description: row.description ?? "",
      status: row.status ?? (row.is_active === false ? "Inactive" : "Active"),
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== false,
    }),
  },
  costCodes: {
    table: "cost_codes",
    orderBy: ["sort_order", "name"],
    mapItemToRow: (costCode) => ({
      id: costCode.id,
      code: costCode.code || "",
      name: costCode.name || "",
      stage: costCode.stage || "",
      trade: costCode.trade || "",
      description: costCode.description || "",
      status: costCode.status || (costCode.isActive === false ? "Inactive" : "Active"),
      sort_order: Number(costCode.sortOrder || 0),
      is_active: costCode.isActive !== false,
    }),
    mapRowToItem: (row) => ({
      id: row.id ?? "",
      code: row.code ?? "",
      name: row.name ?? "",
      stage: row.stage ?? "",
      trade: row.trade ?? "",
      description: row.description ?? "",
      status: row.status ?? (row.is_active === false ? "Inactive" : "Active"),
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== false,
    }),
  },
  itemFamilies: {
    table: "item_families",
    orderBy: ["sort_order", "name"],
    mapItemToRow: (itemFamily) => ({
      id: itemFamily.id,
      name: itemFamily.name || "",
      sort_order: Number(itemFamily.sortOrder || 0),
      is_active: itemFamily.isActive !== false,
    }),
    mapRowToItem: (row) => ({
      id: row.id ?? "",
      name: row.name ?? "",
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== false,
    }),
  },
  stages: {
    table: "stages",
    orderBy: ["sort_order", "name"],
    mapItemToRow: (stage) => ({
      id: stage.id,
      name: stage.name || "",
      sort_order: Number(stage.sortOrder || 0),
      is_active: stage.isActive !== false,
      color: stage.color || "#d7aa5a",
    }),
    mapRowToItem: (row) => ({
      id: row.id ?? "",
      name: row.name ?? "",
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== false,
      color: row.color ?? "#d7aa5a",
    }),
  },
  elements: {
    table: "elements",
    orderBy: ["sort_order", "name"],
    mapItemToRow: (element) => ({
      id: element.id,
      name: element.name || "",
      sort_order: Number(element.sortOrder || 0),
      is_active: element.isActive !== false,
    }),
    mapRowToItem: (row) => ({
      id: row.id ?? "",
      name: row.name ?? "",
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== false,
    }),
  },
  costs: {
    table: "cost_items",
    orderBy: ["sort_order", "item_name"],
    mapItemToRow: mapCostItemToSupabaseRow,
    mapRowToItem: mapSupabaseCostRowToItem,
  },
  parameters: {
    table: "parameters",
    orderBy: ["sort_order", "label"],
    mapItemToRow: (parameter) => ({
      id: parameter.id,
      key: parameter.key || "",
      label: parameter.label || "",
      parameter_type: parameter.parameterType || "",
      input_type: parameter.inputType || "",
      unit: parameter.unit || "",
      default_value: parameter.defaultValue ?? null,
      is_required: Boolean(parameter.required),
      sort_order:
        parameter.sortOrder === "" || parameter.sortOrder == null
          ? null
          : Number(parameter.sortOrder),
      category: parameter.category || "",
      formula: parameter.formula || "",
      description: parameter.description || "",
      status: parameter.status || "Active",
    }),
    mapRowToItem: (row) => ({
      id: row.id ?? "",
      key: row.key ?? "",
      label: row.label ?? "",
      parameterType: row.parameter_type ?? "",
      inputType: row.input_type ?? "",
      unit: row.unit ?? "",
      defaultValue: row.default_value ?? "",
      required: Boolean(row.is_required),
      sortOrder: row.sort_order ?? "",
      category: row.category ?? "",
      formula: row.formula ?? "",
      description: row.description ?? "",
      status: row.status ?? "Active",
    }),
  },
  roomTypes: {
    table: "room_types",
    orderBy: ["sort_order", "name"],
    mapItemToRow: (roomType) => ({
      id: roomType.id,
      name: roomType.name || "",
      sort_order: Number(roomType.sortOrder || 0),
      is_active: roomType.isActive !== false,
      parameter_definitions: roomType.parameterDefinitions || [],
    }),
    mapRowToItem: (row) => ({
      id: row.id ?? "",
      name: row.name ?? "",
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== false,
      parameterDefinitions: row.parameter_definitions || [],
    }),
  },
  roomTemplates: {
    table: "room_templates",
    orderBy: ["name"],
    mapItemToRow: (roomTemplate) => ({
      id: roomTemplate.id,
      name: roomTemplate.name || "",
      room_type_id: roomTemplate.roomTypeId || "",
      room_type: roomTemplate.roomType || "",
      quantity: Number(roomTemplate.quantity || 0),
      is_included: roomTemplate.include !== false,
      template_data: roomTemplate,
    }),
    mapRowToItem: (row) => {
      const payload = row.template_data || {};

      return {
        ...payload,
        id: row.id ?? payload.id ?? "",
        name: row.name ?? payload.name ?? "",
        roomTypeId: row.room_type_id ?? payload.roomTypeId ?? "",
        roomType: row.room_type ?? payload.roomType ?? "",
        quantity: row.quantity ?? payload.quantity ?? 0,
        include: row.is_included ?? payload.include ?? true,
      };
    },
  },
  assemblyLineTemplates: {
    table: "assembly_line_templates",
    orderBy: ["sort_order", "name"],
    mapItemToRow: (template) => ({
      id: template.id,
      name: template.name || "",
      cost_item_id: template.costItemId || "",
      cost_item_name_snapshot: template.costItemNameSnapshot || "",
      default_formula: template.defaultFormula || "",
      default_qty_rule: template.defaultQtyRule || "",
      default_waste_factor:
        template.defaultWasteFactor === "" || template.defaultWasteFactor == null
          ? null
          : Number(template.defaultWasteFactor),
      default_unit: template.defaultUnit || "",
      default_rate_override:
        template.defaultRateOverride === "" || template.defaultRateOverride == null
          ? null
          : Number(template.defaultRateOverride),
      trade_id: template.tradeId || "",
      cost_code_id: template.costCodeId || "",
      room_type: template.roomType || "",
      assembly_group: template.assemblyGroup || "",
      assembly_element: template.assemblyElement || "",
      assembly_scope: template.assemblyScope || "",
      notes: template.notes || "",
      sort_order: Number(template.sortOrder || 0),
      is_active: template.isActive !== false,
    }),
    mapRowToItem: (row) => ({
      id: row.id ?? "",
      name: row.name ?? "",
      costItemId: row.cost_item_id ?? "",
      costItemNameSnapshot: row.cost_item_name_snapshot ?? "",
      defaultFormula: row.default_formula ?? "",
      defaultQtyRule: row.default_qty_rule ?? "",
      defaultWasteFactor: row.default_waste_factor ?? "",
      defaultUnit: row.default_unit ?? "",
      defaultRateOverride: row.default_rate_override ?? "",
      tradeId: row.trade_id ?? "",
      costCodeId: row.cost_code_id ?? "",
      roomType: row.room_type ?? "",
      assemblyGroup: row.assembly_group ?? "",
      assemblyElement: row.assembly_element ?? "",
      assemblyScope: row.assembly_scope ?? "",
      notes: row.notes ?? "",
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== false,
    }),
  },
  assemblies: {
    table: "assemblies",
    orderBy: ["sort_order", "assembly_name"],
    mapItemToRow: mapAssemblyToSupabaseRow,
    mapRowToItem: mapAssemblyRowToItem,
  },
};

function getLibraryConfig(libraryKey) {
  const config = libraryConfigs[libraryKey];

  if (!config) {
    throw new Error(`Unknown library config: ${libraryKey}`);
  }

  return config;
}

async function fetchCollection(table, mapRowToItem, orderBy = []) {
  if (!hasSupabaseCredentials || !supabase) {
    return null;
  }

  let query = supabase.from(table).select("*");
  orderBy.forEach((column) => {
    query = query.order(column, { ascending: true, nullsFirst: false });
  });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []).map(mapRowToItem);
}

async function fetchAssembliesCollection() {
  if (!hasSupabaseCredentials || !supabase) {
    return null;
  }

  let assemblyQuery = supabase.from("assemblies").select("*");
  ["sort_order", "assembly_name"].forEach((column) => {
    assemblyQuery = assemblyQuery.order(column, { ascending: true, nullsFirst: false });
  });

  const { data: assemblyRows, error: assemblyError } = await assemblyQuery;

  if (assemblyError) {
    throw assemblyError;
  }

  const assemblyIds = (assemblyRows || []).map((row) => row.id).filter(Boolean);
  let itemRows = [];

  if (assemblyIds.length) {
    let itemQuery = supabase.from("assembly_items").select("*").in("assembly_id", assemblyIds);
    ["assembly_id", "sort_order", "line_name"].forEach((column) => {
      itemQuery = itemQuery.order(column, { ascending: true, nullsFirst: false });
    });

    const { data, error } = await itemQuery;
    if (error) {
      throw error;
    }
    itemRows = data || [];
  }

  const itemsByAssemblyId = itemRows.reduce((map, row) => {
    const assemblyId = row.assembly_id;
    if (!map.has(assemblyId)) {
      map.set(assemblyId, []);
    }
    map.get(assemblyId).push(row);
    return map;
  }, new Map());

  return (assemblyRows || []).map((row) =>
    mapAssemblyRowToItem(row, itemsByAssemblyId.get(row.id) || [])
  );
}

async function replaceCollection(table, items, mapItemToRow) {
  if (!hasSupabaseCredentials || !supabase) {
    return;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from(table)
    .select("id");

  if (existingError) {
    throw existingError;
  }

  const existingIds = new Set((existingRows || []).map((row) => row.id));
  const nextRows = (items || []).map(mapItemToRow);
  const nextIds = new Set(nextRows.map((row) => row.id).filter(Boolean));
  const deletedIds = [...existingIds].filter((id) => !nextIds.has(id));

  for (const idsChunk of chunkItems(deletedIds)) {
    if (!idsChunk.length) {
      continue;
    }

    const { error } = await supabase.from(table).delete().in("id", idsChunk);
    if (error) {
      throw error;
    }
  }

  for (const rowsChunk of chunkItems(nextRows)) {
    if (!rowsChunk.length) {
      continue;
    }

    const { error } = await supabase.from(table).upsert(rowsChunk, { onConflict: "id" });
    if (error) {
      throw error;
    }
  }
}

export async function fetchLibraryItems(libraryKey) {
  if (libraryKey === "assemblies") {
    return fetchAssembliesCollection();
  }
  const { table, mapRowToItem, orderBy = [] } = getLibraryConfig(libraryKey);
  return fetchCollection(table, mapRowToItem, orderBy);
}

export async function replaceLibraryItems(libraryKey, items) {
  const { table, mapItemToRow } = getLibraryConfig(libraryKey);
  return replaceCollection(table, items, mapItemToRow);
}

export async function fetchCostItemsFromSupabase() {
  const items = await fetchLibraryItems("costs");
  return Array.isArray(items) ? items : [];
}

export async function saveCostItemToSupabase(cost) {
  if (!hasSupabaseCredentials || !supabase) {
    const fallbackId = cost.id || cost.internalId || `cost-${Date.now()}`;
    return {
      ...cost,
      id: fallbackId,
      internalId: cost.internalId || fallbackId,
    };
  }

  const payload = mapCostItemToSupabaseRow(cost);
  const { data, error } = await supabase
    .from("cost_items")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapSupabaseCostRowToItem(data);
}

export async function saveAssemblyWithItems(assembly) {
  if (!hasSupabaseCredentials || !supabase) {
    const error = new Error("Supabase client is not configured for assembly save.");
    console.error("[Dynex][AssemblyLibrary] Supabase unavailable for saveAssemblyWithItems", {
      hasSupabaseCredentials,
      hasClient: Boolean(supabase),
      assemblyId: assembly?.id || "",
    });
    throw error;
  }

  const assemblyId = toText(assembly?.id);
  if (!assemblyId) {
    throw new Error("Assembly id is required for Supabase save.");
  }

  const assemblyRow = mapAssemblyToSupabaseRow(assembly);
  const childRows = (assembly.items || []).map((item, index) =>
    mapAssemblyItemToSupabaseRow(item, assemblyId, index)
  );

  console.info("[Dynex][AssemblyLibrary] assemblies upsert:start", {
    assemblyId,
    itemCount: childRows.length,
  });

  const { error: assemblyError } = await supabase
    .from("assemblies")
    .upsert(assemblyRow, { onConflict: "id" });
  if (assemblyError) {
    console.error("[Dynex][AssemblyLibrary] assemblies upsert:error", assemblyError);
    throw assemblyError;
  }
  console.info("[Dynex][AssemblyLibrary] assemblies upsert:success", { assemblyId });

  console.info("[Dynex][AssemblyLibrary] assembly_items delete:start", { assemblyId });
  const { error: deleteChildrenError } = await supabase
    .from("assembly_items")
    .delete()
    .eq("assembly_id", assemblyId);
  if (deleteChildrenError) {
    console.error("[Dynex][AssemblyLibrary] assembly_items delete:error", deleteChildrenError);
    throw deleteChildrenError;
  }
  console.info("[Dynex][AssemblyLibrary] assembly_items delete:success", { assemblyId });

  if (childRows.length) {
    console.info("[Dynex][AssemblyLibrary] assembly_items insert:start", {
      assemblyId,
      rowCount: childRows.length,
    });
    const { error: insertChildrenError } = await supabase
      .from("assembly_items")
      .insert(childRows);
    if (insertChildrenError) {
      console.error("[Dynex][AssemblyLibrary] assembly_items insert:error", insertChildrenError);
      throw insertChildrenError;
    }
    console.info("[Dynex][AssemblyLibrary] assembly_items insert:success", {
      assemblyId,
      rowCount: childRows.length,
    });
  } else {
    console.info("[Dynex][AssemblyLibrary] assembly_items insert:skipped-empty", {
      assemblyId,
    });
  }

  return assembly;
}

export async function deleteAssemblyWithItems(assemblyId) {
  if (!hasSupabaseCredentials || !supabase) {
    const error = new Error("Supabase client is not configured for assembly delete.");
    console.error("[Dynex][AssemblyLibrary] Supabase unavailable for deleteAssemblyWithItems", {
      hasSupabaseCredentials,
      hasClient: Boolean(supabase),
      assemblyId: toText(assemblyId),
    });
    throw error;
  }

  const normalizedAssemblyId = toText(assemblyId);
  if (!normalizedAssemblyId) {
    return;
  }

  const { error: deleteChildrenError } = await supabase
    .from("assembly_items")
    .delete()
    .eq("assembly_id", normalizedAssemblyId);
  if (deleteChildrenError) {
    throw deleteChildrenError;
  }

  const { error: deleteAssemblyError } = await supabase
    .from("assemblies")
    .delete()
    .eq("id", normalizedAssemblyId);
  if (deleteAssemblyError) {
    throw deleteAssemblyError;
  }
}

export async function replaceAssembliesWithItems(assemblies = []) {
  if (!hasSupabaseCredentials || !supabase) {
    const error = new Error("Supabase client is not configured for assembly resync.");
    console.error("[Dynex][AssemblyLibrary] Supabase unavailable for replaceAssembliesWithItems", {
      hasSupabaseCredentials,
      hasClient: Boolean(supabase),
      assemblyCount: (assemblies || []).length,
    });
    throw error;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("assemblies")
    .select("id");
  if (existingError) {
    throw existingError;
  }

  const nextIds = new Set((assemblies || []).map((assembly) => toText(assembly.id)).filter(Boolean));
  const deletedIds = (existingRows || [])
    .map((row) => row.id)
    .filter((id) => id && !nextIds.has(id));

  for (const assemblyId of deletedIds) {
    await deleteAssemblyWithItems(assemblyId);
  }

  for (const assembly of assemblies || []) {
    await saveAssemblyWithItems(assembly);
  }

  return assemblies;
}

export async function fetchDynexLibraryState() {
  if (!hasSupabaseCredentials || !supabase) {
    return null;
  }

  const libraryKeys = [
    "roomTypes",
    "parameters",
    "units",
    "costCodes",
    "stages",
    "trades",
    "itemFamilies",
    "elements",
    "roomTemplates",
    "assemblyLineTemplates",
    "assemblies",
    "costs",
  ];

  const results = await Promise.allSettled(
    libraryKeys.map(async (libraryKey) => ({
      libraryKey,
      value: await fetchLibraryItems(libraryKey),
    }))
  );

  return Object.fromEntries(
    results.flatMap((result) => {
      if (result.status === "fulfilled") {
        const { libraryKey, value } = result.value;
        return Array.isArray(value) ? [[libraryKey, value]] : [];
      }

      console.error("[Dynex] Failed to fetch Supabase library", result.reason);
      return [];
    })
  );
}

export function getSupabaseLibraryLabel(libraryKey) {
  switch (libraryKey) {
    case "costCodes":
      return "cost codes";
    case "itemFamilies":
      return "item families";
    case "roomTypes":
      return "room types";
    case "roomTemplates":
      return "room templates";
    default:
      return cleanText(libraryKey);
  }
}



