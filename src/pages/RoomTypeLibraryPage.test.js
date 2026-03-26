import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoomTypeLibraryPage from "./RoomTypeLibraryPage";

test("room type library adds a parameter from the parameter library with local overrides", async () => {
  const onRoomTypesChange = jest.fn();

  render(
    <RoomTypeLibraryPage
      roomTypes={[
        {
          id: "room-type-study",
          name: "Study",
          sortOrder: 1,
          isActive: true,
          parameterDefinitions: [],
        },
      ]}
      parameters={[
        {
          id: "parameter-desk-count",
          key: "deskCount",
          label: "Desk Count",
          inputType: "number",
          unit: "ea",
          defaultValue: 2,
        },
      ]}
      onRoomTypesChange={onRoomTypesChange}
    />
  );

  await userEvent.click(screen.getByRole("button", { name: /manage study/i }));

  const parameterForm = document.querySelector(".room-type-parameter-form");

  await userEvent.selectOptions(
    within(parameterForm).getByDisplayValue("Select parameter"),
    "parameter-desk-count"
  );
  await userEvent.selectOptions(
    within(parameterForm).getByDisplayValue("No"),
    "true"
  );
  await userEvent.clear(
    within(parameterForm).getByPlaceholderText("2")
  );
  await userEvent.type(
    within(parameterForm).getByPlaceholderText("2"),
    "4"
  );
  await userEvent.click(screen.getByRole("button", { name: /add parameter/i }));

  expect(onRoomTypesChange).toHaveBeenCalledWith([
    expect.objectContaining({
      id: "room-type-study",
      parameterDefinitions: [
        expect.objectContaining({
          parameterId: "parameter-desk-count",
          defaultValue: 4,
          isRequired: true,
          sortOrder: 1,
        }),
      ],
    }),
  ]);
});
