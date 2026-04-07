import { useEffect, useMemo, useState } from "react";
import EstimatePresentationView from "../components/presentation/EstimatePresentationView";
import { fetchEstimateShareLink } from "../lib/shareLinks";
import { buildEstimatePresentationModel } from "../utils/presentationModel";

function EstimateShareView({ shareId }) {
  const [shareRecord, setShareRecord] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [clientGroupBy, setClientGroupBy] = useState("room");

  useEffect(() => {
    let isMounted = true;

    async function loadShareLink() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const record = await fetchEstimateShareLink(shareId);

        if (isMounted) {
          setShareRecord(record);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || "Unable to load this estimate.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadShareLink();

    return () => {
      isMounted = false;
    };
  }, [shareId]);

  useEffect(() => {
    if (!shareRecord) {
      return;
    }

    setClientGroupBy(
      shareRecord.presentation_settings?.clientGroupBy ||
        (shareRecord.presentation_settings?.allowedClientGroupings || ["room"])[0] ||
        "room"
    );
  }, [shareRecord]);

  const presentationModel = useMemo(() => {
    if (!shareRecord) {
      return null;
    }

    const shareSettings = shareRecord.presentation_settings || {};
    const allowedGroupings =
      shareSettings.allowedClientGroupings?.filter((group) => Boolean(group)) || ["room", "stage"];
    const allowSwitch =
      typeof shareSettings.allowClientGroupingSwitch === "boolean"
        ? shareSettings.allowClientGroupingSwitch
        : true;
    const hideQuantitiesSetting =
      shareSettings.clientHideQuantities ??
      Boolean(shareSettings.visibility?.hideQuantities ?? true);

    return buildEstimatePresentationModel({
      rows: shareRecord.rows_snapshot || [],
      sections: shareRecord.sections_snapshot || [],
      projectRooms: shareRecord.project_rooms_snapshot || [],
      generatedRowSectionAssignments: shareRecord.generated_row_section_assignments || {},
      project: shareRecord.project_snapshot || {},
      mode: "client",
      groupBy: clientGroupBy,
      clientGroupBy,
      allowedClientGroupings: allowedGroupings,
      allowClientGroupingSwitch: allowSwitch,
      presentationLayout: shareSettings.presentationLayout,
      clientPrimaryLabelField: shareSettings.clientPrimaryLabelField,
      clientLineItemDetailFields: shareSettings.clientLineItemDetailFields,
      clientHideQuantities: hideQuantitiesSetting,
      clientShowUnits: shareSettings.clientShowUnits,
      visibility: {
        ...(shareSettings.visibility || {}),
        hideUnitRates: true,
      },
      markupPercent: shareSettings.markupPercent ?? 0,
      gstEnabled: shareSettings.gstEnabled !== false,
      gstRate: shareSettings.gstRate ?? 0.1,
    });
  }, [shareRecord, clientGroupBy]);

  const sharePresentationControls = useMemo(() => {
    if (!shareRecord) {
      return null;
    }

    const shareSettings = shareRecord.presentation_settings || {};
    const allowedGroupings =
      shareSettings.allowedClientGroupings?.filter((group) => Boolean(group)) || ["room", "stage"];
    const allowSwitch =
      typeof shareSettings.allowClientGroupingSwitch === "boolean"
        ? shareSettings.allowClientGroupingSwitch
        : true;

      return {
        groupBy: clientGroupBy,
        allowedGroupings,
        allowGroupingSwitch: allowSwitch,
        onGroupChange: setClientGroupBy,
      };
  }, [shareRecord, clientGroupBy]);

  if (isLoading) {
    return (
      <main className="estimate-share-view">
        <p className="empty-state">Loading shared estimate…</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="estimate-share-view">
        <div className="estimate-share-view__message is-error">{errorMessage}</div>
      </main>
    );
  }

  return (
    <main className="estimate-share-view">
      <div className="estimate-share-view__banner">Read-only client share view</div>
      <EstimatePresentationView model={presentationModel} clientControls={sharePresentationControls} />
    </main>
  );
}

export default EstimateShareView;
