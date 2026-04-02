import {
  findStageIdByLegacyValue,
  getDefaultStageId,
  getStageIntegrity,
  isStageIdValid,
  normalizeStageBoundRecord,
} from "./stageIntegrity";

const stages = [
  { id: "stage-demolition", name: "Demolition", sortOrder: 1, isActive: true },
  { id: "stage-rough-in", name: "Rough-In", sortOrder: 2, isActive: true },
  { id: "stage-finishes", name: "Finishes", sortOrder: 3, isActive: true },
];

test("accepts valid stage ids directly", () => {
  expect(isStageIdValid("stage-finishes", stages)).toBe(true);
  expect(
    getStageIntegrity("stage-finishes", stages, "").stageId
  ).toBe("stage-finishes");
});

test("maps legacy stage names and numeric indexes to stage library ids", () => {
  expect(findStageIdByLegacyValue("Demolition", stages)).toBe("stage-demolition");
  expect(findStageIdByLegacyValue("rough in", stages)).toBe("stage-rough-in");
  expect(findStageIdByLegacyValue("1", stages)).toBe("stage-demolition");
  expect(findStageIdByLegacyValue("3", stages)).toBe("stage-finishes");
});

test("falls back invalid stage ids to the default stage", () => {
  expect(getDefaultStageId(stages)).toBe("stage-demolition");

  expect(getStageIntegrity("", stages, "").stageId).toBe("stage-demolition");
  expect(getStageIntegrity("999", stages, "").stageId).toBe("stage-demolition");
  expect(getStageIntegrity("legacy-stage", stages, "").stageId).toBe("stage-demolition");
});

test("normalizes stage-bound records to valid stage library ids", () => {
  expect(
    normalizeStageBoundRecord(
      { id: "row-1", stageId: "", stage: "" },
      stages,
      { context: "manual-estimate-line" }
    )
  ).toMatchObject({
    id: "row-1",
    stageId: "stage-demolition",
  });

  expect(
    normalizeStageBoundRecord(
      { id: "row-2", stageId: "rough in", stage: "Rough-In" },
      stages,
      { context: "manual-estimate-line" }
    )
  ).toMatchObject({
    id: "row-2",
    stageId: "stage-rough-in",
  });
});
