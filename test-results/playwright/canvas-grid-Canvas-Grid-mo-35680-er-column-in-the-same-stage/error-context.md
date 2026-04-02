# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: canvas-grid.spec.js >> Canvas Grid >> moves a card to another column in the same stage
- Location: playwright\canvas-grid.spec.js:106:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('canvas-track-cell-stage-prelims-0-0').locator('[data-testid^="canvas-card-"]')
Expected: 0
Received: 1
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for getByTestId('canvas-track-cell-stage-prelims-0-0').locator('[data-testid^="canvas-card-"]')
    13 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - complementary [ref=e5]:
    - navigation "App sections" [ref=e6]:
      - generic [ref=e7]:
        - paragraph [ref=e8]: Workflow
        - generic [ref=e9]:
          - button "Estimate Builder" [ref=e10] [cursor=pointer]:
            - generic [ref=e11]: ◫
            - generic [ref=e12]: Estimate Builder
          - button "Summary Dashboard" [ref=e13] [cursor=pointer]:
            - generic [ref=e14]: ◧
            - generic [ref=e15]: Summary Dashboard
          - button "Labour Summary" [ref=e16] [cursor=pointer]:
            - generic [ref=e17]: ◌
            - generic [ref=e18]: Labour Summary
          - button "Missing Rates" [ref=e19] [cursor=pointer]:
            - generic [ref=e20]: "!"
            - generic [ref=e21]: Missing Rates
          - button "Estimate Output" [ref=e22] [cursor=pointer]:
            - generic [ref=e23]: ≡
            - generic [ref=e24]: Estimate Output
      - generic [ref=e25]:
        - paragraph [ref=e26]: Core Libraries
        - generic [ref=e27]:
          - button "Stage Library" [ref=e28] [cursor=pointer]:
            - generic [ref=e29]: ◔
            - generic [ref=e30]: Stage Library
          - button "Trade Library" [ref=e31] [cursor=pointer]:
            - generic [ref=e32]: ⇄
            - generic [ref=e33]: Trade Library
          - button "Element Library" [ref=e34] [cursor=pointer]:
            - generic [ref=e35]: ▣
            - generic [ref=e36]: Element Library
          - button "Parameter Library" [ref=e37] [cursor=pointer]:
            - generic [ref=e38]: ⌘
            - generic [ref=e39]: Parameter Library
          - button "Unit Library" [ref=e40] [cursor=pointer]:
            - generic [ref=e41]: "#"
            - generic [ref=e42]: Unit Library
          - button "Cost Code Library" [ref=e43] [cursor=pointer]:
            - generic [ref=e44]: ⌗
            - generic [ref=e45]: Cost Code Library
          - button "Cost Library" [ref=e46] [cursor=pointer]:
            - generic [ref=e47]: $
            - generic [ref=e48]: Cost Library
          - button "Item Family Library" [ref=e49] [cursor=pointer]:
            - generic [ref=e50]: "@"
            - generic [ref=e51]: Item Family Library
      - generic [ref=e52]:
        - paragraph [ref=e53]: Room Setup
        - generic [ref=e54]:
          - button "Room Type Library" [ref=e55] [cursor=pointer]:
            - generic [ref=e56]: ⌂
            - generic [ref=e57]: Room Type Library
          - button "Room Library" [ref=e58] [cursor=pointer]:
            - generic [ref=e59]: ▤
            - generic [ref=e60]: Room Library
          - button "Assembly Library" [ref=e61] [cursor=pointer]:
            - generic [ref=e62]: ▦
            - generic [ref=e63]: Assembly Library
  - main [ref=e64]:
    - generic [ref=e65]:
      - generic "dynex identity" [ref=e66]: dynex
      - button "Project menu" [ref=e68] [cursor=pointer]:
        - generic [ref=e69]: Playwright Project (Rev 3)
        - generic [ref=e70]: ">"
    - generic [ref=e72]:
      - generic [ref=e73]:
        - generic [ref=e74]:
          - tablist "Estimate views" [ref=e75]:
            - tab "Builder View" [ref=e76] [cursor=pointer]
            - tab "Canvas View" [selected] [ref=e77] [cursor=pointer]
          - generic [ref=e78]:
            - generic [ref=e79]: Estimate Workspace
            - generic [ref=e80]:
              - strong [ref=e81]: Canvas Browser Test
              - generic [ref=e82]: Rev 3
        - generic [ref=e83]:
          - searchbox "Search canvas" [ref=e84]
          - button "Filter" [ref=e85] [cursor=pointer]
          - group [ref=e86]:
            - generic "Add" [ref=e87] [cursor=pointer]
      - generic [ref=e90]:
        - generic [ref=e91]:
          - generic [ref=e92]:
            - heading "Canvas View" [level=2] [ref=e93]
            - paragraph [ref=e94]: Rows are stages, columns are sequence, and tracks represent parallel work.
          - generic [ref=e95]:
            - generic [ref=e96]: Canvas Browser Test
            - generic [ref=e97]: 5 visible cards
            - generic [ref=e98]: 2 stages
            - 'button "Debug Mode: On" [ref=e99] [cursor=pointer]'
        - generic [ref=e100]:
          - strong [ref=e101]: Active target
          - generic [ref=e102]: idle
        - generic [ref=e103]:
          - generic [ref=e104]:
            - generic [ref=e105]:
              - generic [ref=e106]:
                - generic [ref=e107]: S1
                - strong [ref=e108]: Preliminaries
                - generic [ref=e109]:
                  - generic [ref=e110]: "stage: stage-prelims"
                  - generic [ref=e111]: "columns: 3"
                  - generic [ref=e112]: "tracks: 3"
                  - generic [ref=e113]: "cards: 3"
              - generic [ref=e116]:
                - generic [ref=e117]:
                  - button "Insert column 1 track 1 in Preliminaries" [ref=e118]:
                    - generic: slot 0:0
                  - button "Insert column 1 track 2 in Preliminaries" [ref=e120]:
                    - generic: slot 0:1
                  - button "Insert column 1 track 3 in Preliminaries" [ref=e122]:
                    - generic: slot 0:2
                - generic [ref=e124]:
                  - button "track slot 0" [ref=e125]:
                    - generic: track slot 0
                  - button "Site fencing General • Preliminaries • Main Works Supply $1,500.00 ID manual-row-1 Stage stage-prelims Column 0 Track 0" [ref=e128] [cursor=pointer]:
                    - generic [ref=e129]:
                      - generic [ref=e130]: MW
                      - generic [ref=e131]:
                        - strong [ref=e132]: Site fencing
                        - generic [ref=e133]: General • Preliminaries • Main Works
                    - generic [ref=e134]:
                      - generic [ref=e135]: Supply
                      - strong [ref=e136]: $1,500.00
                    - generic [ref=e137]:
                      - generic [ref=e138]:
                        - term [ref=e139]: ID
                        - definition [ref=e140]: manual-row-1
                      - generic [ref=e141]:
                        - term [ref=e142]: Stage
                        - definition [ref=e143]: stage-prelims
                      - generic [ref=e144]:
                        - term [ref=e145]: Column
                        - definition [ref=e146]: "0"
                      - generic [ref=e147]:
                        - term [ref=e148]: Track
                        - definition [ref=e149]: "0"
                  - button "track slot 1" [ref=e150]:
                    - generic: track slot 1
                - generic [ref=e152]:
                  - button "Insert column 2 track 1 in Preliminaries" [ref=e153]:
                    - generic: slot 1:0
                  - button "Insert column 2 track 2 in Preliminaries" [ref=e155]:
                    - generic: slot 1:1
                  - button "Insert column 2 track 3 in Preliminaries" [ref=e157]:
                    - generic: slot 1:2
                - generic [ref=e159]:
                  - button "track slot 0" [ref=e160]:
                    - generic: track slot 0
                  - button "Pump hire General • Preliminaries • Main Works Equipment $700.00 ID manual-row-2 Stage stage-prelims Column 1 Track 0" [ref=e163] [cursor=pointer]:
                    - generic [ref=e164]:
                      - generic [ref=e165]: MW
                      - generic [ref=e166]:
                        - strong [ref=e167]: Pump hire
                        - generic [ref=e168]: General • Preliminaries • Main Works
                    - generic [ref=e169]:
                      - generic [ref=e170]: Equipment
                      - strong [ref=e171]: $700.00
                    - generic [ref=e172]:
                      - generic [ref=e173]:
                        - term [ref=e174]: ID
                        - definition [ref=e175]: manual-row-2
                      - generic [ref=e176]:
                        - term [ref=e177]: Stage
                        - definition [ref=e178]: stage-prelims
                      - generic [ref=e179]:
                        - term [ref=e180]: Column
                        - definition [ref=e181]: "1"
                      - generic [ref=e182]:
                        - term [ref=e183]: Track
                        - definition [ref=e184]: "0"
                  - button "track slot 1" [ref=e185]:
                    - generic: track slot 1
                - generic [ref=e187]:
                  - button "Insert column 3 track 1 in Preliminaries" [ref=e188]:
                    - generic: slot 2:0
                  - button "Insert column 3 track 2 in Preliminaries" [ref=e190]:
                    - generic: slot 2:1
                  - button "Insert column 3 track 3 in Preliminaries" [ref=e192]:
                    - generic: slot 2:2
                - generic [ref=e194]:
                  - button "track slot 0" [ref=e195]:
                    - generic: track slot 0
                  - button "Reo install General • Preliminaries • Main Works Labour $900.00 ID manual-row-3 Stage stage-prelims Column 2 Track 0" [ref=e198] [cursor=pointer]:
                    - generic [ref=e199]:
                      - generic [ref=e200]: MW
                      - generic [ref=e201]:
                        - strong [ref=e202]: Reo install
                        - generic [ref=e203]: General • Preliminaries • Main Works
                    - generic [ref=e204]:
                      - generic [ref=e205]: Labour
                      - strong [ref=e206]: $900.00
                    - generic [ref=e207]:
                      - generic [ref=e208]:
                        - term [ref=e209]: ID
                        - definition [ref=e210]: manual-row-3
                      - generic [ref=e211]:
                        - term [ref=e212]: Stage
                        - definition [ref=e213]: stage-prelims
                      - generic [ref=e214]:
                        - term [ref=e215]: Column
                        - definition [ref=e216]: "2"
                      - generic [ref=e217]:
                        - term [ref=e218]: Track
                        - definition [ref=e219]: "0"
                  - button "track slot 1" [ref=e220]:
                    - generic: track slot 1
                - generic [ref=e222]:
                  - button "Insert column 4 track 1 in Preliminaries" [ref=e223]:
                    - generic: slot 3:0
                  - button "Insert column 4 track 2 in Preliminaries" [ref=e225]:
                    - generic: slot 3:1
                  - button "Insert column 4 track 3 in Preliminaries" [ref=e227]:
                    - generic: slot 3:2
            - generic [ref=e229]:
              - generic [ref=e230]:
                - generic [ref=e231]: S2
                - strong [ref=e232]: Demolition
                - generic [ref=e233]:
                  - generic [ref=e234]: "stage: stage-demo"
                  - generic [ref=e235]: "columns: 2"
                  - generic [ref=e236]: "tracks: 3"
                  - generic [ref=e237]: "cards: 2"
              - generic [ref=e240]:
                - generic [ref=e241]:
                  - button "Insert column 1 track 1 in Demolition" [ref=e242]:
                    - generic: slot 0:0
                  - button "Insert column 1 track 2 in Demolition" [ref=e244]:
                    - generic: slot 0:1
                  - button "Insert column 1 track 3 in Demolition" [ref=e246]:
                    - generic: slot 0:2
                - generic [ref=e248]:
                  - button "track slot 0" [ref=e249]:
                    - generic: track slot 0
                  - button "Stripout setup General • Preliminaries • Main Works Labour $800.00 ID manual-row-4 Stage stage-demo Column 0 Track 0" [ref=e252] [cursor=pointer]:
                    - generic [ref=e253]:
                      - generic [ref=e254]: MW
                      - generic [ref=e255]:
                        - strong [ref=e256]: Stripout setup
                        - generic [ref=e257]: General • Preliminaries • Main Works
                    - generic [ref=e258]:
                      - generic [ref=e259]: Labour
                      - strong [ref=e260]: $800.00
                    - generic [ref=e261]:
                      - generic [ref=e262]:
                        - term [ref=e263]: ID
                        - definition [ref=e264]: manual-row-4
                      - generic [ref=e265]:
                        - term [ref=e266]: Stage
                        - definition [ref=e267]: stage-demo
                      - generic [ref=e268]:
                        - term [ref=e269]: Column
                        - definition [ref=e270]: "0"
                      - generic [ref=e271]:
                        - term [ref=e272]: Track
                        - definition [ref=e273]: "0"
                  - button "track slot 1" [ref=e274]:
                    - generic: track slot 1
                - generic [ref=e276]:
                  - button "Insert column 2 track 1 in Demolition" [ref=e277]:
                    - generic: slot 1:0
                  - button "Insert column 2 track 2 in Demolition" [ref=e279]:
                    - generic: slot 1:1
                  - button "Insert column 2 track 3 in Demolition" [ref=e281]:
                    - generic: slot 1:2
                - generic [ref=e283]:
                  - button "track slot 0" [ref=e284]:
                    - generic: track slot 0
                  - button "Survey setout General • Preliminaries • Main Works Labour $600.00 ID manual-row-5 Stage stage-demo Column 1 Track 0" [ref=e287] [cursor=pointer]:
                    - generic [ref=e288]:
                      - generic [ref=e289]: MW
                      - generic [ref=e290]:
                        - strong [ref=e291]: Survey setout
                        - generic [ref=e292]: General • Preliminaries • Main Works
                    - generic [ref=e293]:
                      - generic [ref=e294]: Labour
                      - strong [ref=e295]: $600.00
                    - generic [ref=e296]:
                      - generic [ref=e297]:
                        - term [ref=e298]: ID
                        - definition [ref=e299]: manual-row-5
                      - generic [ref=e300]:
                        - term [ref=e301]: Stage
                        - definition [ref=e302]: stage-demo
                      - generic [ref=e303]:
                        - term [ref=e304]: Column
                        - definition [ref=e305]: "1"
                      - generic [ref=e306]:
                        - term [ref=e307]: Track
                        - definition [ref=e308]: "0"
                  - button "track slot 1" [ref=e309]:
                    - generic: track slot 1
                - generic [ref=e311]:
                  - button "Insert column 3 track 1 in Demolition" [ref=e312]:
                    - generic: slot 2:0
                  - button "Insert column 3 track 2 in Demolition" [ref=e314]:
                    - generic: slot 2:1
                  - button "Insert column 3 track 3 in Demolition" [ref=e316]:
                    - generic: slot 2:2
          - complementary [ref=e318]:
            - generic [ref=e319]:
              - heading "Select a card" [level=3] [ref=e320]
              - paragraph [ref=e321]: Choose a card to inspect stage, trade, cost, and notes without leaving the board.
```

# Test source

```ts
  2   | const { seedCanvasApp } = require("./support/canvasTestUtils");
  3   | 
  4   | async function openCanvas(page) {
  5   |   if (!page.__canvasConsoleBound) {
  6   |     page.__canvasConsoleBound = true;
  7   |     page.on("console", (message) => {
  8   |       console.log(`[browser:${message.type()}] ${message.text()}`);
  9   |     });
  10  |   }
  11  |   await page.goto("http://localhost:3000/?canvasTest=1&canvasDebug=1");
  12  |   await page.getByTestId("workspace-view-canvas").click();
  13  |   await expect(page.getByTestId("canvas-debug-active-target")).toBeVisible();
  14  | }
  15  | 
  16  | async function getRect(locator) {
  17  |   return locator.evaluate((element) => {
  18  |     const { x, y, width, height } = element.getBoundingClientRect();
  19  |     return { x, y, width, height };
  20  |   });
  21  | }
  22  | 
  23  | async function dragCardToTarget(page, cardId, targetTestId) {
  24  |   const card = page.getByTestId(`canvas-card-${cardId}`);
  25  |   const rawTarget = page.getByTestId(targetTestId);
  26  |   const target = (await rawTarget.getAttribute("data-canvas-drop-type"))
  27  |     ? rawTarget
  28  |     : rawTarget.locator("[data-canvas-drop-type]").first();
  29  | 
  30  |   await card.evaluate((element) =>
  31  |     element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" })
  32  |   );
  33  |   await target.evaluate((element) =>
  34  |     element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" })
  35  |   );
  36  | 
  37  |   const source = await getRect(card);
  38  |   const destination = await getRect(target);
  39  |   const targetMeta = await target.evaluate((element) => ({
  40  |     type: element.getAttribute("data-canvas-drop-type") || "",
  41  |     stageId: element.getAttribute("data-canvas-stage-id") || "",
  42  |     columnIndex: Number(element.getAttribute("data-canvas-column-index") || 0),
  43  |     track: Number(element.getAttribute("data-canvas-track") || 0),
  44  |   }));
  45  | 
  46  |   const expectedLabel =
  47  |     targetMeta.type === "insert-column"
  48  |       ? `insert column / ${targetMeta.stageId} / column ${targetMeta.columnIndex} / track ${targetMeta.track}`
  49  |       : `track cell / ${targetMeta.stageId} / column ${targetMeta.columnIndex} / track ${targetMeta.track}`;
  50  | 
  51  |   await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  52  |   await page.mouse.down();
  53  |   await page.mouse.move(source.x + source.width / 2 + 24, source.y + source.height / 2 + 24, {
  54  |     steps: 5,
  55  |   });
  56  |   const candidatePoints = [
  57  |     { x: destination.x + destination.width / 2, y: destination.y + destination.height / 2 },
  58  |     { x: destination.x + Math.min(12, destination.width - 6), y: destination.y + destination.height / 2 },
  59  |     { x: destination.x + destination.width / 2, y: destination.y + Math.min(12, destination.height - 6) },
  60  |     { x: destination.x + destination.width / 2, y: destination.y + Math.max(destination.height - 12, 6) },
  61  |     { x: destination.x + Math.max(destination.width - 12, 6), y: destination.y + destination.height / 2 },
  62  |   ];
  63  | 
  64  |   let targetActivated = false;
  65  | 
  66  |   for (const point of candidatePoints) {
  67  |     await page.mouse.move(point.x, point.y, { steps: 10 });
  68  |     await page.waitForTimeout(16);
  69  | 
  70  |     const activeTargetText = await page.getByTestId("canvas-debug-active-target").textContent();
  71  | 
  72  |     if ((activeTargetText || "").includes(expectedLabel)) {
  73  |       targetActivated = true;
  74  |       break;
  75  |     }
  76  |   }
  77  | 
  78  |   if (!targetActivated) {
  79  |     try {
  80  |       await expect
  81  |         .poll(async () => page.getByTestId("canvas-debug-active-target").textContent(), {
  82  |           timeout: 500,
  83  |         })
  84  |         .toContain(expectedLabel);
  85  |     } catch {
  86  |       // The debug indicator is useful, but post-drop DOM assertions remain the browser source of truth.
  87  |     }
  88  |   }
  89  | 
  90  |   await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, {
  91  |     steps: 2,
  92  |   });
  93  | 
  94  |   await page.mouse.up();
  95  | }
  96  | 
  97  | async function expectCellToContainCard(page, cellTestId, cardId) {
  98  |   await expect(page.getByTestId(cellTestId).getByTestId(`canvas-card-${cardId}`)).toBeVisible();
  99  | }
  100 | 
  101 | async function expectCellToBeEmpty(page, cellTestId) {
> 102 |   await expect(page.getByTestId(cellTestId).locator('[data-testid^="canvas-card-"]')).toHaveCount(0);
      |                                                                                       ^ Error: expect(locator).toHaveCount(expected) failed
  103 | }
  104 | 
  105 | test.describe("Canvas Grid", () => {
  106 |   test("moves a card to another column in the same stage", async ({ page }) => {
  107 |     await seedCanvasApp(page);
  108 |     await openCanvas(page);
  109 | 
  110 |     await dragCardToTarget(page, "manual-row-1", "canvas-column-slot-stage-prelims-2");
  111 | 
  112 |     await expectCellToBeEmpty(page, "canvas-track-cell-stage-prelims-0-0");
  113 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-1-0", "manual-row-2");
  114 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-2-0", "manual-row-1");
  115 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-3-0", "manual-row-3");
  116 |   });
  117 | 
  118 |   test("inserts a card between two columns", async ({ page }) => {
  119 |     await seedCanvasApp(page);
  120 |     await openCanvas(page);
  121 | 
  122 |     await dragCardToTarget(page, "manual-row-4", "canvas-column-slot-stage-prelims-1");
  123 | 
  124 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-0", "manual-row-1");
  125 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-1-0", "manual-row-4");
  126 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-2-0", "manual-row-2");
  127 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-3-0", "manual-row-3");
  128 |   });
  129 | 
  130 |   test("inserts a card at the end of a row", async ({ page }) => {
  131 |     await seedCanvasApp(page);
  132 |     await openCanvas(page);
  133 | 
  134 |     await dragCardToTarget(page, "manual-row-4", "canvas-column-slot-stage-prelims-3");
  135 | 
  136 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-3-0", "manual-row-4");
  137 |   });
  138 | 
  139 |   test("inserts above the top-most card in a column", async ({ page }) => {
  140 |     await seedCanvasApp(page);
  141 |     await openCanvas(page);
  142 | 
  143 |     await dragCardToTarget(page, "manual-row-2", "canvas-track-slot-stage-prelims-0-0");
  144 | 
  145 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-0", "manual-row-2");
  146 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-1");
  147 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-2-0", "manual-row-3");
  148 |   });
  149 | 
  150 |   test("inserts between two cards in a column and shifts lower cards down", async ({ page }) => {
  151 |     await seedCanvasApp(page);
  152 |     await openCanvas(page);
  153 | 
  154 |     await dragCardToTarget(page, "manual-row-2", "canvas-track-slot-stage-prelims-0-1");
  155 |     await dragCardToTarget(page, "manual-row-3", "canvas-track-slot-stage-prelims-0-1");
  156 | 
  157 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-0", "manual-row-1");
  158 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-3");
  159 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-2", "manual-row-2");
  160 |     await expectCellToBeEmpty(page, "canvas-track-cell-stage-prelims-1-0");
  161 |   });
  162 | 
  163 |   test("inserts below the bottom-most card in a column", async ({ page }) => {
  164 |     await seedCanvasApp(page);
  165 |     await openCanvas(page);
  166 | 
  167 |     await dragCardToTarget(page, "manual-row-2", "canvas-track-slot-stage-prelims-0-1");
  168 | 
  169 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-0", "manual-row-1");
  170 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-2");
  171 |   });
  172 | 
  173 |   test("moves a card across stages", async ({ page }) => {
  174 |     await seedCanvasApp(page);
  175 |     await openCanvas(page);
  176 | 
  177 |     await dragCardToTarget(page, "manual-row-1", "canvas-column-slot-stage-demo-1");
  178 | 
  179 |     await expectCellToContainCard(page, "canvas-track-cell-stage-demo-0-0", "manual-row-4");
  180 |     await expectCellToContainCard(page, "canvas-track-cell-stage-demo-1-0", "manual-row-1");
  181 |     await expectCellToContainCard(page, "canvas-track-cell-stage-demo-2-0", "manual-row-5");
  182 |   });
  183 | 
  184 |   test("persists stage, column, and track after reload", async ({ browser }) => {
  185 |     const context = await browser.newContext({
  186 |       viewport: { width: 1600, height: 1200 },
  187 |     });
  188 |     const page = await context.newPage();
  189 | 
  190 |     await seedCanvasApp(page);
  191 |     await openCanvas(page);
  192 | 
  193 |     await dragCardToTarget(page, "manual-row-2", "canvas-track-slot-stage-prelims-0-1");
  194 |     await dragCardToTarget(page, "manual-row-4", "canvas-column-slot-stage-prelims-2");
  195 | 
  196 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-2");
  197 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-2-0", "manual-row-4");
  198 | 
  199 |     await page.reload();
  200 |     await page.getByTestId("workspace-view-canvas").click();
  201 | 
  202 |     await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-2");
```