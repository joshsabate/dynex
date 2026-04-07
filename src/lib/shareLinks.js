import { hasSupabaseCredentials, supabase } from "./supabase";

const SHARE_LINKS_TABLE = "estimate_share_links";
const SHARE_LINK_VERSION = 1;

function generateShareId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
}

export function buildShareUrl(shareId, origin = typeof window !== "undefined" ? window.location.origin : "") {
  return `${origin}/share/${shareId}`;
}

export async function createEstimateShareLink({
  estimateId,
  project,
  rows,
  sections,
  projectRooms,
  generatedRowSectionAssignments,
  presentationSettings,
}) {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const shareId = generateShareId();
  const timestamp = new Date().toISOString();
  const payload = {
    estimate_id: estimateId,
    share_id: shareId,
    version: SHARE_LINK_VERSION,
    status: "active",
    project_snapshot: project,
    rows_snapshot: rows,
    sections_snapshot: sections,
    project_rooms_snapshot: projectRooms,
    generated_row_section_assignments: generatedRowSectionAssignments,
    presentation_settings: presentationSettings,
    updated_at: timestamp,
  };

  const { error } = await supabase.from(SHARE_LINKS_TABLE).insert({
    ...payload,
    created_at: timestamp,
  });

  if (error) {
    throw new Error(error.message || "Unable to create share link.");
  }

  return {
    shareId,
    version: SHARE_LINK_VERSION,
  };
}

export async function fetchEstimateShareLink(shareId) {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from(SHARE_LINKS_TABLE)
    .select("*")
    .eq("share_id", shareId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load share link.");
  }

  if (!data) {
    throw new Error("This share link could not be found.");
  }

  return data;
}

