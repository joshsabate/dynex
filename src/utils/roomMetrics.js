import { evaluateFormula } from "./quantitySources";

function toNumber(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function clampHeight(value, max) {
  return Math.min(toNumber(value), toNumber(max));
}

function roundMetric(value) {
  return Math.round(value * 100) / 100;
}

export function calculateRoomMetrics(room) {
  const length = toNumber(room.length);
  const width = toNumber(room.width);
  const height = toNumber(room.height);
  const tileHeight = clampHeight(room.tileHeight, height);
  const waterproofWallHeight = clampHeight(room.waterproofWallHeight, height);
  const quantity = Math.max(toNumber(room.quantity), 0);
  const baseCabinetLength = toNumber(room.baseCabinetLength);
  const overheadCabinetLength = toNumber(room.overheadCabinetLength);
  const benchtopLength = toNumber(room.benchtopLength);
  const splashbackLength = toNumber(room.splashbackLength);
  const splashbackHeight = toNumber(room.splashbackHeight);

  const floorAreaPerRoom = length * width;
  const perimeterPerRoom = 2 * (length + width);
  const ceilingAreaPerRoom = floorAreaPerRoom;
  const tileWallAreaPerRoom = perimeterPerRoom * tileHeight;
  const waterproofWallAreaPerRoom = perimeterPerRoom * waterproofWallHeight;
  const splashbackAreaPerRoom = splashbackLength * splashbackHeight;
  const multiplier = room.include ? quantity : 0;

  return {
    length,
    width,
    height,
    tileHeight,
    waterproofWallHeight,
    baseCabinetLength,
    overheadCabinetLength,
    benchtopLength,
    splashbackLength,
    splashbackHeight,
    quantity,
    floorArea: roundMetric(floorAreaPerRoom * multiplier),
    perimeter: roundMetric(perimeterPerRoom * multiplier),
    tileWallArea: roundMetric(tileWallAreaPerRoom * multiplier),
    waterproofFloorArea: roundMetric(floorAreaPerRoom * multiplier),
    waterproofWallArea: roundMetric(waterproofWallAreaPerRoom * multiplier),
    ceilingArea: roundMetric(ceilingAreaPerRoom * multiplier),
    skirtingLength: roundMetric(perimeterPerRoom * multiplier),
    baseCabinetLengthTotal: roundMetric(baseCabinetLength * multiplier),
    overheadCabinetLengthTotal: roundMetric(overheadCabinetLength * multiplier),
    benchtopLengthTotal: roundMetric(benchtopLength * multiplier),
    splashbackLengthTotal: roundMetric(splashbackLength * multiplier),
    splashbackArea: roundMetric(splashbackAreaPerRoom * multiplier),
  };
}

export function getQtyRuleQuantity(qtyRule, roomMetrics) {
  switch (qtyRule) {
    case "1":
      return roomMetrics.quantity;
    case "FloorArea":
      return roomMetrics.floorArea;
    case "Perimeter":
      return roomMetrics.perimeter;
    case "TileWallArea":
      return roomMetrics.tileWallArea;
    case "WaterproofFloorArea":
      return roomMetrics.waterproofFloorArea;
    case "WaterproofWallArea":
      return roomMetrics.waterproofWallArea;
    case "CeilingArea":
      return roomMetrics.ceilingArea;
    case "SkirtingLength":
      return roomMetrics.skirtingLength;
    case "BaseCabinetLength":
      return roomMetrics.baseCabinetLengthTotal;
    case "OverheadCabinetLength":
      return roomMetrics.overheadCabinetLengthTotal;
    case "BenchtopLength":
      return roomMetrics.benchtopLengthTotal;
    case "SplashbackArea":
      return roomMetrics.splashbackArea;
    case "SplashbackLength":
      return roomMetrics.splashbackLengthTotal;
    default:
      return roundMetric(evaluateFormula(qtyRule, roomMetrics, roomMetrics));
  }
}
