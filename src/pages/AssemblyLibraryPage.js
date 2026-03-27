import { useRef, useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { qtyRules } from "../data/seedData";
import { getAssemblyGroupId } from "../utils/assemblyGroups";
import { convertAssembliesToCSV, parseCSV } from "../utils/csvUtils";
import { getStructuredItemPresentation, workTypeOptions } from "../utils/itemNaming";
import { calculateRoomMetrics, getQtyRuleQuantity } from "../utils/roomMetrics";
import { getStagePresentation } from "../utils/stages";
import { getUnitAbbreviation, isHourUnit } from "../utils/units";

const defaultForm = {
  assemblyCategory: "Finishes",
  assemblyName: "",
  appliesToRoomTypeId: "room-type-bedroom",
  stageId: "stage-finishes",
  elementId: "element-floor",
  tradeId: "trade-general",
  costCodeId: "cost-code-finishes",
  costItemId: "",
  itemName: "",
  workType: "Supply",
  itemFamily: "",
  specification: "",
  gradeOrQuality: "",
  brand: "",
  finishOrVariant: "",
  laborHoursPerUnit: "0",
  laborCostItemId: "",
  laborCostItemName: "",
  unitId: "unit-sqm",
  qtyRule: "FloorArea",
  sortOrder: "1",
};

const defaultFilters = {
  stageId: "",
  appliesToRoomTypeId: "",
  tradeId: "",
  costCodeId: "",
};

const defaultPreviewInputs = {
  length: "3",
  width: "2",
  height: "2.7",
  tileHeight: "2.1",
  waterproofWallHeight: "1.2",
  baseCabinetLength: "2.4",
  overheadCabinetLength: "1.8",
  benchtopLength: "2.4",
  splashbackLength: "2.2",
  splashbackHeight: "0.6",
  quantity: "1",
};

const qtyRulePreviewConfig = {
  "1": {
    inputKeys: ["quantity"],
    derivedKeys: ["quantity"],
  },
  FloorArea: {
    inputKeys: ["length", "width", "quantity"],
    derivedKeys: ["floorArea"],
  },
  Perimeter: {
    inputKeys: ["length", "width", "quantity"],
    derivedKeys: ["perimeter"],
  },
  TileWallArea: {
    inputKeys: ["length", "width", "height", "tileHeight", "quantity"],
    derivedKeys: ["perimeter", "tileWallArea"],
  },
  WaterproofFloorArea: {
    inputKeys: ["length", "width", "quantity"],
    derivedKeys: ["waterproofFloorArea"],
  },
  WaterproofWallArea: {
    inputKeys: ["length", "width", "height", "waterproofWallHeight", "quantity"],
    derivedKeys: ["perimeter", "waterproofWallArea"],
  },
  CeilingArea: {
    inputKeys: ["length", "width", "quantity"],
    derivedKeys: ["ceilingArea"],
  },
  SkirtingLength: {
    inputKeys: ["length", "width", "quantity"],
    derivedKeys: ["skirtingLength"],
  },
  BaseCabinetLength: {
    inputKeys: ["baseCabinetLength", "quantity"],
    derivedKeys: ["baseCabinetLengthTotal"],
  },
  OverheadCabinetLength: {
    inputKeys: ["overheadCabinetLength", "quantity"],
    derivedKeys: ["overheadCabinetLengthTotal"],
  },
  BenchtopLength: {
    inputKeys: ["benchtopLength", "quantity"],
    derivedKeys: ["benchtopLengthTotal"],
  },
  SplashbackArea: {
    inputKeys: ["splashbackLength", "splashbackHeight", "quantity"],
    derivedKeys: ["splashbackArea"],
  },
  SplashbackLength: {
    inputKeys: ["splashbackLength", "quantity"],
    derivedKeys: ["splashbackLengthTotal"],
  },
};

const previewInputLabels = {
  length: "Length",
  width: "Width",
  height: "Height",
  tileHeight: "Tile Height",
  waterproofWallHeight: "Waterproof Wall Height",
  baseCabinetLength: "Base Cabinet Length",
  overheadCabinetLength: "Overhead Cabinet Length",
  benchtopLength: "Benchtop Length",
  splashbackLength: "Splashback Length",
  splashbackHeight: "Splashback Height",
  quantity: "Quantity",
};

const previewInputUnits = {
  length: "m",
  width: "m",
  height: "m",
  tileHeight: "m",
  waterproofWallHeight: "m",
  baseCabinetLength: "m",
  overheadCabinetLength: "m",
  benchtopLength: "m",
  splashbackLength: "m",
  splashbackHeight: "m",
};

const derivedMetricLabels = {
  quantity: "Quantity",
  floorArea: "Floor Area",
  perimeter: "Perimeter",
  tileWallArea: "Tile Wall Area",
  waterproofFloorArea: "Waterproof Floor Area",
  waterproofWallArea: "Waterproof Wall Area",
  ceilingArea: "Ceiling Area",
  skirtingLength: "Skirting Length",
  baseCabinetLengthTotal: "Base Cabinet Length",
  overheadCabinetLengthTotal: "Overhead Cabinet Length",
  benchtopLengthTotal: "Benchtop Length",
  splashbackLengthTotal: "Splashback Length",
  splashbackArea: "Splashback Area",
};

const derivedMetricUnits = {
  floorArea: "sq m",
  perimeter: "m",
  tileWallArea: "sq m",
  waterproofFloorArea: "sq m",
  waterproofWallArea: "sq m",
  ceilingArea: "sq m",
  skirtingLength: "m",
  baseCabinetLengthTotal: "m",
  overheadCabinetLengthTotal: "m",
  benchtopLengthTotal: "m",
  splashbackLengthTotal: "m",
  splashbackArea: "sq m",
};

function AssemblyLibraryPage({
  assemblies,
  stages,
  trades,
  elements,
  roomTypes,
  costCodes,
  itemFamilies = [],
  units,
  costs,
  onAssembliesChange,
}) {
  const importFileInputRef = useRef(null);
  const [form, setForm] = useState(defaultForm);
  const [filters, setFilters] = useState(defaultFilters);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [collapsedAssemblyGroups, setCollapsedAssemblyGroups] = useState({});
  const [previewAssemblyGroupId, setPreviewAssemblyGroupId] = useState("");
  const [previewInputsByGroup, setPreviewInputsByGroup] = useState({});
  const [csvStatus, setCsvStatus] = useState("");
  const activeStages = [...stages]
    .filter((stage) => stage.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const activeTrades = [...trades]
    .filter((trade) => trade.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const activeElements = [...elements]
    .filter((element) => element.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const activeRoomTypes = [...roomTypes]
    .filter((roomType) => roomType.isActive)
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
    );
  const activeCostCodes = [...costCodes]
    .filter((costCode) => costCode.isActive)
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
    );
  const activeUnits = [...units]
    .filter((unit) => unit.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const activeItemFamilies = [...itemFamilies]
    .filter((itemFamily) => itemFamily.isActive !== false)
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
    );

  const getStageName = (stageId, fallback = "") =>
    stages.find((stage) => stage.id === stageId)?.name || fallback || "Unassigned";
  const getStageSelectStyle = (stageId, fallback = "") => getStagePresentation(stages, stageId, fallback);
  const getTradeName = (tradeId, fallback = "") =>
    trades.find((trade) => trade.id === tradeId)?.name || fallback || "Unassigned";
  const getElementName = (elementId, fallback = "") =>
    elements.find((element) => element.id === elementId)?.name || fallback || "Unassigned";
  const getRoomTypeName = (roomTypeId, fallback = "") =>
    roomTypes.find((roomType) => roomType.id === roomTypeId)?.name || fallback || "Unassigned";
  const getCostCodeName = (costCodeId, fallback = "") =>
    costCodes.find((costCode) => costCode.id === costCodeId)?.name || fallback || "Unassigned";
  const getUnitLabel = (unitId, fallback = "") =>
    getUnitAbbreviation(units, unitId, fallback, fallback);
  const getCostItem = (costItemId, fallbackName = "") =>
    costs.find((cost) => cost.id === costItemId) ||
    costs.find((cost) => cost.itemName === fallbackName) ||
    null;
  const getUnitIdFromValue = (value) => {
    const normalizedValue = String(value || "").trim().toLowerCase();

    return (
      units.find(
        (unit) =>
          unit.id === value ||
          String(unit.abbreviation || "").trim().toLowerCase() === normalizedValue ||
          String(unit.name || "").trim().toLowerCase() === normalizedValue
      )?.id || ""
    );
  };
  const sortedCosts = [...costs].sort(
    (left, right) => left.itemName.localeCompare(right.itemName) || left.id.localeCompare(right.id)
  );
  const getDisplayName = (item) => getStructuredItemPresentation(item).displayName;

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateCostItemField = (value) => {
    const selectedCost = getCostItem(value);

    setForm((current) => ({
      ...current,
      costItemId: value,
      itemName: selectedCost?.itemName || "",
      itemFamily: selectedCost?.itemFamily || current.itemFamily,
      specification: selectedCost?.specification || current.specification,
      gradeOrQuality: selectedCost?.gradeOrQuality || current.gradeOrQuality,
      brand: selectedCost?.brand || current.brand,
      finishOrVariant: selectedCost?.finishOrVariant || current.finishOrVariant,
      workType:
        selectedCost && isHourUnit(units, selectedCost.unitId, selectedCost.unit)
          ? "Labour"
          : selectedCost?.workType || current.workType,
      unitId: selectedCost?.unitId || "",
      unit: getUnitLabel(selectedCost?.unitId, selectedCost?.unit || ""),
    }));
  };

  const updateLaborCostItemField = (value) => {
    const selectedCost = getCostItem(value);

    setForm((current) => ({
      ...current,
      laborCostItemId: value,
      laborCostItemName: selectedCost?.itemName || "",
    }));
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return { key, direction: "asc" };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) {
      return "";
    }

    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  const toggleAssemblyGroup = (assemblyGroupId) => {
    setCollapsedAssemblyGroups((current) => ({
      ...current,
      [assemblyGroupId]: !(current[assemblyGroupId] ?? true),
    }));
  };

  const addAssemblyRow = (event) => {
    event.preventDefault();
    if (!form.assemblyName || !form.costItemId) {
      return;
    }

    const existingAssembly = assemblies.find(
      (assembly) =>
        assembly.assemblyName === form.assemblyName &&
        assembly.appliesToRoomTypeId === form.appliesToRoomTypeId
    );

    onAssembliesChange([
      ...assemblies,
      {
        id: `assembly-row-${Date.now()}`,
        assemblyId: existingAssembly?.assemblyId || getAssemblyGroupId(form),
        assemblyCategory: form.assemblyCategory,
        assemblyName: form.assemblyName,
        appliesToRoomTypeId: form.appliesToRoomTypeId,
        appliesToRoomType: getRoomTypeName(form.appliesToRoomTypeId),
        stageId: form.stageId,
        stage: getStageName(form.stageId),
        elementId: form.elementId,
        element: getElementName(form.elementId),
        tradeId: form.tradeId,
        trade: getTradeName(form.tradeId),
        costCodeId: form.costCodeId,
        costCode: getCostCodeName(form.costCodeId),
        costItemId: form.costItemId,
        itemName: form.itemName,
        workType: form.workType,
        itemFamily: form.itemFamily,
        specification: form.specification,
        gradeOrQuality: form.gradeOrQuality,
        brand: form.brand,
        finishOrVariant: form.finishOrVariant,
        laborHoursPerUnit: Number(form.laborHoursPerUnit),
        laborCostItemId: form.laborCostItemId,
        laborCostItemName: form.laborCostItemName,
        unitId: form.unitId,
        unit: getUnitLabel(form.unitId),
        qtyRule: form.qtyRule,
        sortOrder: Number(form.sortOrder),
      },
    ]);

    setForm((current) => ({
      ...defaultForm,
      assemblyCategory: current.assemblyCategory,
      appliesToRoomTypeId: current.appliesToRoomTypeId,
      stageId: current.stageId,
      elementId: current.elementId,
      tradeId: current.tradeId,
      costCodeId: current.costCodeId,
      laborCostItemId: current.laborCostItemId,
      laborCostItemName: current.laborCostItemName,
      laborHoursPerUnit: current.laborHoursPerUnit,
      qtyRule: current.qtyRule,
    }));
  };

  const removeAssembly = (assemblyId) => {
    onAssembliesChange(assemblies.filter((assembly) => assembly.id !== assemblyId));
  };

  const readFileAsText = (file) => {
    if (typeof file?.text === "function") {
      return file.text();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Unable to read file"));
      reader.readAsText(file);
    });
  };

  const exportAssembliesAsCsv = () => {
    if (typeof window === "undefined") {
      return;
    }

    const csvText = convertAssembliesToCSV(
      assemblies.map((assembly) => {
        const linkedCost = getCostItem(assembly.costItemId, assembly.itemName);

        return {
          assemblyName: assembly.assemblyName || "",
          itemName: assembly.itemName || "",
          description: assembly.description || "",
          qtyRule: assembly.qtyRule || "",
          unit: getUnitLabel(assembly.unitId, assembly.unit || ""),
          unitCost: assembly.unitCost ?? linkedCost?.rate ?? "",
          itemType: assembly.itemType || assembly.assemblyCategory || "",
        };
      })
    );
    const csvBlob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = window.URL.createObjectURL(csvBlob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "assemblies-export.csv";
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
    setCsvStatus(`Exported ${assemblies.length} assembly rows.`);
  };

  const importAssembliesFromCsv = async (file) => {
    if (!file) {
      return;
    }

    try {
      const csvText = await readFileAsText(file);
      const parsedRows = parseCSV(csvText);
      const validRows = [];
      let skippedRows = 0;

      parsedRows.forEach((row, index) => {
        const assemblyName = String(row["Assembly Name"] || "").trim();
        const itemName = String(row["Item Name"] || "").trim();

        if (!assemblyName || !itemName) {
          skippedRows += 1;
          return;
        }

        validRows.push({
          rowNumber: index + 2,
          assemblyName,
          itemName,
          description: String(row.Description || "").trim(),
          qtyRule: String(row["Quantity Formula"] || "").trim() || defaultForm.qtyRule,
          unit: String(row.Unit || "").trim(),
          unitCost: String(row["Unit Cost"] || "").trim(),
          itemType: String(row["Item Type"] || "").trim() || defaultForm.assemblyCategory,
        });
      });

      if (!validRows.length) {
        setCsvStatus("Unable to import CSV. No valid assembly rows were found.");
        return;
      }

      const assemblyIdByName = new Map();
      const nextAssemblies = validRows.map((row, index) => {
        const unitId = getUnitIdFromValue(row.unit);
        const linkedCost =
          costs.find((cost) => cost.itemName === row.itemName && (!unitId || cost.unitId === unitId)) ||
          costs.find((cost) => cost.itemName === row.itemName) ||
          null;
        const assemblyId =
          assemblyIdByName.get(row.assemblyName) ||
          getAssemblyGroupId({
            assemblyName: row.assemblyName,
            appliesToRoomTypeId: defaultForm.appliesToRoomTypeId,
          });

        assemblyIdByName.set(row.assemblyName, assemblyId);

        return {
          id: `assembly-row-import-${Date.now()}-${index}`,
          assemblyId,
          assemblyCategory: row.itemType,
          assemblyName: row.assemblyName,
          appliesToRoomTypeId: defaultForm.appliesToRoomTypeId,
          appliesToRoomType: getRoomTypeName(defaultForm.appliesToRoomTypeId),
          stageId: defaultForm.stageId,
          stage: getStageName(defaultForm.stageId),
          elementId: defaultForm.elementId,
          element: getElementName(defaultForm.elementId),
          tradeId: defaultForm.tradeId,
          trade: getTradeName(defaultForm.tradeId),
          costCodeId: defaultForm.costCodeId,
          costCode: getCostCodeName(defaultForm.costCodeId),
          costItemId: linkedCost?.id || "",
          itemName: row.itemName,
          workType: "",
          itemFamily: "",
          specification: "",
          gradeOrQuality: "",
          brand: "",
          finishOrVariant: "",
          description: row.description,
          laborHoursPerUnit: 0,
          laborCostItemId: "",
          laborCostItemName: "",
          unitId: unitId || linkedCost?.unitId || "",
          unit: row.unit || getUnitLabel(linkedCost?.unitId, linkedCost?.unit || ""),
          qtyRule: row.qtyRule,
          sortOrder: assemblies.length + index + 1,
          unitCost:
            row.unitCost === ""
              ? linkedCost?.rate ?? ""
              : Number.isFinite(Number(row.unitCost))
                ? Number(row.unitCost)
                : row.unitCost,
          itemType: row.itemType,
        };
      });

      onAssembliesChange([...assemblies, ...nextAssemblies]);
      setCsvStatus(
        `${assemblyIdByName.size} assemblies imported${
          skippedRows ? `. ${skippedRows} invalid row${skippedRows === 1 ? "" : "s"} skipped.` : "."
        }`
      );
    } catch (error) {
      setCsvStatus("Unable to import CSV. Please choose a valid CSV file.");
    }
  };

  const addItemToAssembly = (assemblyGroup) => {
    const templateRow = assemblyGroup.rows[0];

    onAssembliesChange([
      ...assemblies,
      {
        id: `assembly-row-${Date.now()}`,
        assemblyId: templateRow.assemblyId || assemblyGroup.id,
        assemblyCategory: templateRow.assemblyCategory,
        assemblyName: templateRow.assemblyName,
        appliesToRoomTypeId: templateRow.appliesToRoomTypeId,
        appliesToRoomType: templateRow.appliesToRoomType,
        stageId: templateRow.stageId || "",
        stage: templateRow.stage,
        elementId: templateRow.elementId || "",
        element: templateRow.element,
        tradeId: templateRow.tradeId || "",
        trade: templateRow.trade,
        costCodeId: templateRow.costCodeId || "",
        costCode: templateRow.costCode,
        costItemId: "",
        itemName: "",
        workType: templateRow.workType || "",
        itemFamily: templateRow.itemFamily || "",
        specification: templateRow.specification || "",
        gradeOrQuality: templateRow.gradeOrQuality || "",
        brand: templateRow.brand || "",
        finishOrVariant: templateRow.finishOrVariant || "",
        laborHoursPerUnit: 0,
        laborCostItemId: templateRow.laborCostItemId || "",
        laborCostItemName: "",
        unitId: "",
        unit: "",
        qtyRule: templateRow.qtyRule,
        sortOrder: Math.max(...assemblyGroup.rows.map((row) => row.sortOrder ?? 0), 0) + 1,
      },
    ]);
  };

  const updateAssembly = (assemblyId, key, value) => {
    onAssembliesChange(
      assemblies.map((assembly) =>
        assembly.id === assemblyId
          ? (() => {
              if (key === "costItemId") {
                const selectedCost = getCostItem(value);

                return {
                  ...assembly,
                  costItemId: value,
                  itemName: selectedCost?.itemName || "",
                  itemFamily: selectedCost?.itemFamily || assembly.itemFamily,
                  specification: selectedCost?.specification || assembly.specification,
                  gradeOrQuality: selectedCost?.gradeOrQuality || assembly.gradeOrQuality,
                  brand: selectedCost?.brand || assembly.brand,
                  finishOrVariant: selectedCost?.finishOrVariant || assembly.finishOrVariant,
                  workType:
                    selectedCost && isHourUnit(units, selectedCost.unitId, selectedCost.unit)
                      ? "Labour"
                      : selectedCost?.workType || assembly.workType,
                  unitId: selectedCost?.unitId || "",
                  unit: getUnitLabel(selectedCost?.unitId, selectedCost?.unit || ""),
                };
              }

              if (key === "laborCostItemId") {
                const selectedCost = getCostItem(value);

                return {
                  ...assembly,
                  laborCostItemId: value,
                  laborCostItemName: selectedCost?.itemName || "",
                };
              }

              return {
                ...assembly,
                stage:
                  key === "stageId"
                    ? getStageName(value, assembly.stage)
                    : assembly.stage,
                trade:
                  key === "tradeId"
                    ? getTradeName(value, assembly.trade)
                    : assembly.trade,
                element:
                  key === "elementId"
                    ? getElementName(value, assembly.element)
                    : assembly.element,
                appliesToRoomType:
                  key === "appliesToRoomTypeId"
                    ? getRoomTypeName(value, assembly.appliesToRoomType)
                    : assembly.appliesToRoomType,
                costCode:
                  key === "costCodeId"
                    ? getCostCodeName(value, assembly.costCode)
                    : assembly.costCode,
                unit:
                  key === "unitId"
                    ? getUnitLabel(value, assembly.unit)
                    : assembly.unit,
                [key]:
                  key === "sortOrder" || key === "laborHoursPerUnit"
                    ? Number(value)
                    : value,
              };
            })()
          : assembly
      )
    );
  };

  const labourCosts = sortedCosts.filter((cost) => isHourUnit(units, cost.unitId, cost.unit));
  const filteredAssemblies = (() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    const nextRows = assemblies.filter((assembly) => {
      const matchesStage = !filters.stageId || assembly.stageId === filters.stageId;
      const matchesRoomType =
        !filters.appliesToRoomTypeId || assembly.appliesToRoomTypeId === filters.appliesToRoomTypeId;
      const matchesTrade = !filters.tradeId || assembly.tradeId === filters.tradeId;
      const matchesCostCode = !filters.costCodeId || assembly.costCodeId === filters.costCodeId;
      const matchesSearch =
        !normalizedSearchTerm ||
        (assembly.itemName || "").toLowerCase().includes(normalizedSearchTerm) ||
        (assembly.assemblyName || "").toLowerCase().includes(normalizedSearchTerm) ||
        getDisplayName(assembly).toLowerCase().includes(normalizedSearchTerm) ||
        String(assembly.workType || "").toLowerCase().includes(normalizedSearchTerm) ||
        String(assembly.itemFamily || "").toLowerCase().includes(normalizedSearchTerm) ||
        String(assembly.specification || "").toLowerCase().includes(normalizedSearchTerm) ||
        String(assembly.gradeOrQuality || "").toLowerCase().includes(normalizedSearchTerm) ||
        String(assembly.brand || "").toLowerCase().includes(normalizedSearchTerm) ||
        String(assembly.finishOrVariant || "").toLowerCase().includes(normalizedSearchTerm);

      return matchesStage && matchesRoomType && matchesTrade && matchesCostCode && matchesSearch;
    });

    if (!sortConfig.key) {
      return nextRows;
    }

    return [...nextRows].sort((left, right) => {
      const getSortValue = (assembly) => {
        if (sortConfig.key === "stage") {
          return getStageName(assembly.stageId, assembly.stage);
        }

        if (sortConfig.key === "trade") {
          return getTradeName(assembly.tradeId, assembly.trade);
        }

        if (sortConfig.key === "costCode") {
          return getCostCodeName(assembly.costCodeId, assembly.costCode);
        }

        if (sortConfig.key === "itemName") {
          return getDisplayName(assembly);
        }

        return "";
      };

      const leftValue = getSortValue(left);
      const rightValue = getSortValue(right);
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      return (
        leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" }) * direction
      );
    });
  })();
  const groupedAssemblies = filteredAssemblies.reduce((groups, assembly) => {
    const assemblyGroupId = assembly.assemblyId || getAssemblyGroupId(assembly);
    const existingGroup = groups.find((group) => group.id === assemblyGroupId);

    if (existingGroup) {
      existingGroup.rows.push(assembly);
      return groups;
    }

    groups.push({
      id: assemblyGroupId,
      assemblyName: assembly.assemblyName,
      roomType: getRoomTypeName(assembly.appliesToRoomTypeId, assembly.appliesToRoomType),
      rows: [assembly],
    });

    return groups;
  }, []);
  const isAssemblyGroupCollapsed = (assemblyGroupId) =>
    collapsedAssemblyGroups[assemblyGroupId] ?? true;
  const setAllAssemblyGroupsCollapsed = (isCollapsed) => {
    setCollapsedAssemblyGroups(
      Object.fromEntries(groupedAssemblies.map((assemblyGroup) => [assemblyGroup.id, isCollapsed]))
    );
  };

  const sortableHeader = (label, key) => (
    <button
      type="button"
      className="table-sort-button"
      onClick={() => toggleSort(key)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {getSortIndicator(key)}
    </button>
  );

  const getPreviewInputKeys = (rows) =>
    [...new Set(rows.flatMap((row) => qtyRulePreviewConfig[row.qtyRule]?.inputKeys || []))];

  const getPreviewDerivedKeys = (rows) =>
    [...new Set(rows.flatMap((row) => qtyRulePreviewConfig[row.qtyRule]?.derivedKeys || []))];

  const getPreviewInputs = (assemblyGroupId) => ({
    ...defaultPreviewInputs,
    ...(previewInputsByGroup[assemblyGroupId] || {}),
  });

  const getPreviewMetrics = (assemblyGroupId) =>
    calculateRoomMetrics({
      ...getPreviewInputs(assemblyGroupId),
      include: true,
    });

  const togglePreviewPanel = (assemblyGroupId) => {
    setPreviewAssemblyGroupId((current) => (current === assemblyGroupId ? "" : assemblyGroupId));
    setPreviewInputsByGroup((current) => ({
      ...current,
      [assemblyGroupId]: current[assemblyGroupId] || defaultPreviewInputs,
    }));
  };

  const updatePreviewInput = (assemblyGroupId, key, value) => {
    setPreviewInputsByGroup((current) => ({
      ...current,
      [assemblyGroupId]: {
        ...defaultPreviewInputs,
        ...(current[assemblyGroupId] || {}),
        [key]: value,
      },
    }));
  };

  const formatPreviewValue = (value) => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return String(value ?? "");
    }

    return numericValue.toFixed(2);
  };

  return (
    <SectionCard
      title="Assembly Library"
      description="Store assembly library rows. Multiple rows can share the same assembly name so one assembly can expand into multiple estimate items."
    >
      <div className="assembly-library-layout">
        <form className="assembly-library-form" onSubmit={addAssemblyRow}>
          <div className="assembly-library-form-grid">
            <FormField label="Assembly name">
              <input
                value={form.assemblyName}
                onChange={(event) => updateField("assemblyName", event.target.value)}
                placeholder="Bathroom Floor Tile"
              />
            </FormField>

            <FormField label="Stage">
              <select
                value={form.stageId}
                onChange={(event) => updateField("stageId", event.target.value)}
              >
                {activeStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Applies to room type">
              <select
                value={form.appliesToRoomTypeId}
                onChange={(event) => updateField("appliesToRoomTypeId", event.target.value)}
              >
                {activeRoomTypes.map((roomType) => (
                  <option key={roomType.id} value={roomType.id}>
                    {roomType.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Item name">
              <select
                value={form.costItemId}
                onChange={(event) => updateCostItemField(event.target.value)}
              >
                <option value="">Select cost item</option>
                {sortedCosts.map((cost) => (
                  <option key={cost.id} value={cost.id}>
                    {getDisplayName(cost)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Work type">
              <select
                value={form.workType}
                onChange={(event) => updateField("workType", event.target.value)}
              >
                <option value="">Unassigned</option>
                {workTypeOptions.map((workType) => (
                  <option key={workType} value={workType}>
                    {workType}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Item family">
              <select
                value={form.itemFamily}
                onChange={(event) => updateField("itemFamily", event.target.value)}
              >
                <option value="">Unassigned</option>
                {activeItemFamilies.map((itemFamily) => (
                  <option key={itemFamily.id} value={itemFamily.name}>
                    {itemFamily.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Specification">
              <input
                value={form.specification}
                onChange={(event) => updateField("specification", event.target.value)}
                placeholder="90x45"
              />
            </FormField>

            <FormField label="Grade / quality">
              <input
                value={form.gradeOrQuality}
                onChange={(event) => updateField("gradeOrQuality", event.target.value)}
                placeholder="MGP10 LOSP"
              />
            </FormField>

            <FormField label="Brand">
              <input
                value={form.brand}
                onChange={(event) => updateField("brand", event.target.value)}
                placeholder="Caroma"
              />
            </FormField>

            <FormField label="Finish / variant">
              <input
                value={form.finishOrVariant}
                onChange={(event) => updateField("finishOrVariant", event.target.value)}
                placeholder="Matt Black"
              />
            </FormField>

            <FormField label="Trade">
              <select
                value={form.tradeId}
                onChange={(event) => updateField("tradeId", event.target.value)}
              >
                {activeTrades.map((trade) => (
                  <option key={trade.id} value={trade.id}>
                    {trade.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Cost code">
              <select
                value={form.costCodeId}
                onChange={(event) => updateField("costCodeId", event.target.value)}
              >
                {activeCostCodes.map((costCode) => (
                  <option key={costCode.id} value={costCode.id}>
                    {costCode.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Element">
              <select
                value={form.elementId}
                onChange={(event) => updateField("elementId", event.target.value)}
              >
                {activeElements.map((element) => (
                  <option key={element.id} value={element.id}>
                    {element.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Unit">
              <select
                value={form.unitId}
                onChange={(event) => updateField("unitId", event.target.value)}
              >
                {activeUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.abbreviation}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Qty rule">
              <select
                value={form.qtyRule}
                onChange={(event) => updateField("qtyRule", event.target.value)}
              >
                {qtyRules.map((qtyRule) => (
                  <option key={qtyRule} value={qtyRule}>
                    {qtyRule}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Labour hrs / unit">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.laborHoursPerUnit}
                onChange={(event) => updateField("laborHoursPerUnit", event.target.value)}
              />
            </FormField>

            <FormField label="Labour cost item">
              <select
                value={form.laborCostItemId}
                onChange={(event) => updateLaborCostItemField(event.target.value)}
              >
                <option value="">None</option>
                {labourCosts.map((cost) => (
                  <option key={cost.id} value={cost.id}>
                    {getDisplayName(cost)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Assembly category">
              <input
                value={form.assemblyCategory}
                onChange={(event) => updateField("assemblyCategory", event.target.value)}
              />
            </FormField>

            <FormField label="Sort order">
              <input
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(event) => updateField("sortOrder", event.target.value)}
              />
            </FormField>
          </div>
          <div className="action-row assembly-library-form-actions">
            <button type="submit" className="primary-button">
              Add assembly row
            </button>
          </div>
        </form>

        <div className="assembly-library-table-panel">
          <div className="form-grid assembly-library-filters">
            <FormField label="Stage">
              <select
                value={filters.stageId}
                onChange={(event) => updateFilter("stageId", event.target.value)}
              >
                <option value="">All stages</option>
                {activeStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Room Type">
              <select
                value={filters.appliesToRoomTypeId}
                onChange={(event) => updateFilter("appliesToRoomTypeId", event.target.value)}
              >
                <option value="">All room types</option>
                {activeRoomTypes.map((roomType) => (
                  <option key={roomType.id} value={roomType.id}>
                    {roomType.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Trade">
              <select
                value={filters.tradeId}
                onChange={(event) => updateFilter("tradeId", event.target.value)}
              >
                <option value="">All trades</option>
                {activeTrades.map((trade) => (
                  <option key={trade.id} value={trade.id}>
                    {trade.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Cost Code">
              <select
                value={filters.costCodeId}
                onChange={(event) => updateFilter("costCodeId", event.target.value)}
              >
                <option value="">All cost codes</option>
                {activeCostCodes.map((costCode) => (
                  <option key={costCode.id} value={costCode.id}>
                    {costCode.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Search">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search assembly or item name"
              />
            </FormField>
          </div>

          <div className="action-row assembly-library-toolbar-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={exportAssembliesAsCsv}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => importFileInputRef.current?.click()}
            >
              Import CSV
            </button>
            {groupedAssemblies.length ? (
              <>
              <button
                type="button"
                className="estimate-builder-icon-button secondary-button"
                aria-label="Expand All"
                title="Expand All"
                onClick={() => setAllAssemblyGroupsCollapsed(false)}
              >
                <span aria-hidden="true">+</span>
              </button>
              <button
                type="button"
                className="estimate-builder-icon-button secondary-button"
                aria-label="Collapse All"
                title="Collapse All"
                onClick={() => setAllAssemblyGroupsCollapsed(true)}
              >
                <span aria-hidden="true">-</span>
              </button>
              </>
            ) : null}
          </div>

          <input
            ref={importFileInputRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="Import Assembly CSV"
            style={{ position: "absolute", left: "-9999px" }}
            onChange={(event) => {
              const [file] = Array.from(event.target.files || []);
              importAssembliesFromCsv(file || null);
              event.target.value = "";
            }}
          />

          {csvStatus ? <p className="sidebar-status">{csvStatus}</p> : null}

          {groupedAssemblies.length ? (
            <div className="assembly-groups">
              {groupedAssemblies.map((assemblyGroup) => {
                const isExpanded = !isAssemblyGroupCollapsed(assemblyGroup.id);
                return (
                <div
                  key={assemblyGroup.id}
                  className={`assembly-group-card ${isExpanded ? "assembly-group-card-expanded" : ""}`}
                >
                  <div className="assembly-group-header">
                    <button
                      type="button"
                      className="estimate-group-toggle"
                      onClick={() => toggleAssemblyGroup(assemblyGroup.id)}
                    >
                      <span>{isAssemblyGroupCollapsed(assemblyGroup.id) ? "+" : "-"}</span>
                      <span>{assemblyGroup.assemblyName}</span>
                    </button>
                    <div className="assembly-group-meta">
                      <span>{assemblyGroup.roomType}</span>
                      <span>
                        {assemblyGroup.rows.length} item
                        {assemblyGroup.rows.length === 1 ? "" : "s"}
                      </span>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => addItemToAssembly(assemblyGroup)}
                      >
                        Add Item
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => togglePreviewPanel(assemblyGroup.id)}
                      >
                        {previewAssemblyGroupId === assemblyGroup.id ? "Close Preview" : "Preview / Test"}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="assembly-group-body">
                    <DataTable
                      columns={[
                        {
                          key: "itemName",
                          header: sortableHeader("Item Name", "itemName"),
                          className: "assembly-col-item assembly-col-primary assembly-group-end-identity",
                          render: (row) => (
                            <select
                              value={row.costItemId || getCostItem("", row.itemName)?.id || ""}
                              onChange={(event) => updateAssembly(row.id, "costItemId", event.target.value)}
                            >
                              <option value="">Select cost item</option>
                              {sortedCosts.map((cost) => (
                                <option key={cost.id} value={cost.id}>
                                  {getDisplayName(cost)}
                                </option>
                              ))}
                            </select>
                          ),
                        },
                        {
                          key: "stageId",
                          header: sortableHeader("Stage", "stage"),
                          className: "assembly-col-stage assembly-col-primary",
                          render: (row) => (
                            <select
                              className="stage-select"
                              style={getStageSelectStyle(row.stageId, row.stage)}
                              value={row.stageId || ""}
                              onChange={(event) =>
                                updateAssembly(row.id, "stageId", event.target.value)
                              }
                            >
                              <option value="">Unassigned</option>
                              {activeStages.map((stage) => (
                                <option key={stage.id} value={stage.id}>
                                  {stage.name}
                                </option>
                              ))}
                            </select>
                          ),
                        },
                        {
                          key: "tradeId",
                          header: sortableHeader("Trade", "trade"),
                          className: "assembly-col-trade assembly-col-primary",
                          render: (row) => (
                            <select
                              value={row.tradeId || ""}
                              onChange={(event) => updateAssembly(row.id, "tradeId", event.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {activeTrades.map((trade) => (
                                <option key={trade.id} value={trade.id}>
                                  {trade.name}
                                </option>
                              ))}
                            </select>
                          ),
                        },
                        {
                          key: "costCodeId",
                          header: sortableHeader("Cost Code", "costCode"),
                          className: "assembly-col-cost-code assembly-col-primary assembly-group-end-classification",
                          render: (row) => (
                            <select
                              value={row.costCodeId || ""}
                              onChange={(event) => updateAssembly(row.id, "costCodeId", event.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {activeCostCodes.map((costCode) => (
                                <option key={costCode.id} value={costCode.id}>
                                  {costCode.name}
                                </option>
                              ))}
                            </select>
                          ),
                        },
                        {
                          key: "qtyRule",
                          header: "Qty Rule",
                          className: "assembly-col-qty-rule assembly-col-primary",
                          render: (row) => (
                            <select
                              value={row.qtyRule}
                              onChange={(event) => updateAssembly(row.id, "qtyRule", event.target.value)}
                            >
                              {qtyRules.map((qtyRule) => (
                                <option key={qtyRule} value={qtyRule}>
                                  {qtyRule}
                                </option>
                              ))}
                            </select>
                          ),
                        },
                        {
                          key: "unitId",
                          header: "Unit",
                          className: "assembly-col-unit assembly-col-secondary assembly-group-end-values",
                          render: (row) => (
                            <select
                              value={row.unitId || ""}
                              onChange={(event) => updateAssembly(row.id, "unitId", event.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {activeUnits.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.abbreviation}
                                </option>
                              ))}
                            </select>
                          ),
                        },
                        {
                          key: "appliesToRoomTypeId",
                          header: "Room Type",
                          className: "assembly-col-room-type assembly-col-secondary",
                          render: (row) => (
                            <select
                              value={row.appliesToRoomTypeId || ""}
                              onChange={(event) =>
                                updateAssembly(row.id, "appliesToRoomTypeId", event.target.value)
                              }
                            >
                              {activeRoomTypes.map((roomType) => (
                                <option key={roomType.id} value={roomType.id}>
                                  {roomType.name}
                                </option>
                              ))}
                            </select>
                          ),
                        },
                        {
                          key: "laborCostItemName",
                          header: "Labour Cost Item",
                          className: "assembly-col-labour-item assembly-col-secondary",
                          render: (row) => (
                            <select
                              value={row.laborCostItemId || getCostItem("", row.laborCostItemName)?.id || ""}
                              onChange={(event) =>
                                updateAssembly(row.id, "laborCostItemId", event.target.value)
                              }
                            >
                              <option value="">None</option>
                              {labourCosts.map((cost) => (
                                <option key={cost.id} value={cost.id}>
                                  {getDisplayName(cost)}
                                </option>
                              ))}
                            </select>
                          ),
                        },
                      ]}
                      rows={assemblyGroup.rows}
                      emptyMessage="No assembly items."
                      wrapClassName="assembly-library-table-wrap"
                      tableClassName="assembly-library-table"
                      actionsColumnClassName="table-col-actions"
                      renderActions={(row) => (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => removeAssembly(row.id)}
                        >
                          Remove
                        </button>
                      )}
                    />
                    </div>
                  ) : null}

                  {previewAssemblyGroupId === assemblyGroup.id ? (
                    <div className="assembly-preview-panel">
                      <div className="assembly-preview-grid">
                        <div className="assembly-preview-section">
                          <h4>Test Inputs</h4>
                          <div className="form-grid assembly-preview-inputs">
                            {getPreviewInputKeys(assemblyGroup.rows).map((inputKey) => (
                              <FormField
                                key={inputKey}
                                label={`${previewInputLabels[inputKey]}${
                                  previewInputUnits[inputKey]
                                    ? ` (${previewInputUnits[inputKey]})`
                                    : ""
                                }`}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={getPreviewInputs(assemblyGroup.id)[inputKey] || ""}
                                  onChange={(event) =>
                                    updatePreviewInput(
                                      assemblyGroup.id,
                                      inputKey,
                                      event.target.value
                                    )
                                  }
                                />
                              </FormField>
                            ))}
                          </div>
                        </div>

                        <div className="assembly-preview-section">
                          <h4>Derived Values</h4>
                          <div className="assembly-preview-metrics">
                            {getPreviewDerivedKeys(assemblyGroup.rows).map((metricKey) => (
                              <div key={metricKey} className="assembly-preview-metric">
                                <strong>{derivedMetricLabels[metricKey]}</strong>
                                <span>
                                  {formatPreviewValue(getPreviewMetrics(assemblyGroup.id)[metricKey])}
                                  {derivedMetricUnits[metricKey]
                                    ? ` ${derivedMetricUnits[metricKey]}`
                                    : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <DataTable
                        columns={[
                          { key: "itemName", header: "Item" },
                          { key: "qtyRule", header: "Qty Rule" },
                          {
                            key: "calculatedQuantity",
                            header: "Calculated Qty",
                            render: (row) =>
                              formatPreviewValue(
                                getQtyRuleQuantity(row.qtyRule, getPreviewMetrics(assemblyGroup.id))
                              ),
                          },
                          {
                            key: "unit",
                            header: "Unit",
                            render: (row) => getUnitAbbreviation(units, row.unitId, row.unit),
                          },
                        ]}
                        rows={assemblyGroup.rows}
                        emptyMessage="No assembly items."
                      />
                    </div>
                  ) : null}
                </div>
              )})}
            </div>
          ) : (
            <p className="empty-state">
              {assemblies.length
                ? "No assembly rows match the current filters."
                : "No assembly rows added yet."}
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export default AssemblyLibraryPage;
