import { useRef } from "react";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";

function ProjectDetailsPage({
  projectName,
  estimateName,
  clientName,
  projectAddress,
  contactDetails,
  projectManager,
  estimator,
  revision,
  localProjectId,
  createdAt,
  updatedAt,
  hasUnsavedChanges,
  lastSavedAt,
  lastBackupAt,
  lastFileName,
  projectStatus,
  onProjectNameChange,
  onEstimateNameChange,
  onClientNameChange,
  onProjectAddressChange,
  onContactDetailsChange,
  onProjectManagerChange,
  onEstimatorChange,
  onRevisionChange,
  onSaveProject,
  onSaveProjectAs,
  onSaveAsRevision,
  onBeginOpenProject,
  onOpenProject,
  onResetProject,
}) {
  const openFileInputRef = useRef(null);

  return (
    <SectionCard
      title="Project Details"
      description="Manage project metadata and local save/load actions for the current estimate."
    >
      <div className="page-grid library-page">
        <div className="library-form-card">
          <div className="library-form-grid library-form-grid-wide">
            <div className="library-form-span-2">
              <FormField label="Project name">
                <input value={projectName} onChange={(event) => onProjectNameChange(event.target.value)} />
              </FormField>
            </div>

            <div className="library-form-span-2">
              <FormField label="Estimate name">
                <input value={estimateName} onChange={(event) => onEstimateNameChange(event.target.value)} />
              </FormField>
            </div>

            <FormField label="Client name">
              <input value={clientName} onChange={(event) => onClientNameChange(event.target.value)} />
            </FormField>

            <FormField label="Revision">
              <input value={revision} onChange={(event) => onRevisionChange(event.target.value)} />
            </FormField>

            <div className="library-form-span-2">
              <FormField label="Project address">
                <input
                  value={projectAddress}
                  onChange={(event) => onProjectAddressChange(event.target.value)}
                  placeholder="Site or project address"
                />
              </FormField>
            </div>

            <div className="library-form-span-2">
              <FormField label="Contact details">
                <input
                  value={contactDetails}
                  onChange={(event) => onContactDetailsChange(event.target.value)}
                  placeholder="Phone, email, or main contact"
                />
              </FormField>
            </div>

            <FormField label="Project manager">
              <input
                value={projectManager}
                onChange={(event) => onProjectManagerChange(event.target.value)}
              />
            </FormField>

            <FormField label="Estimator">
              <input value={estimator} onChange={(event) => onEstimatorChange(event.target.value)} />
            </FormField>
          </div>

          <div className="action-row library-form-actions">
            <button type="button" className="secondary-button" onClick={onSaveProject}>
              Save Project
            </button>
            <button type="button" className="secondary-button" onClick={onSaveProjectAs}>
              Save As
            </button>
            <button type="button" className="secondary-button" onClick={onSaveAsRevision}>
              Save As Revision
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (onBeginOpenProject()) {
                  openFileInputRef.current?.click();
                }
              }}
            >
              Open Project
            </button>
            <button type="button" className="danger-button" onClick={onResetProject}>
              New Project
            </button>
          </div>

          <input
            ref={openFileInputRef}
            type="file"
            accept=".json,application/json"
            aria-label="Open Project File"
            style={{ position: "absolute", left: "-9999px" }}
            onChange={(event) => {
              const [file] = Array.from(event.target.files || []);
              onOpenProject(file || null);
              event.target.value = "";
            }}
          />
        </div>

        <div className="library-table-panel">
          <div className="summary-section">
            <h3>Project Summary</h3>
            <p className={`project-save-state ${hasUnsavedChanges ? "is-dirty" : "is-saved"}`}>
              {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
            </p>
            <p className="sidebar-meta">Last saved: {lastSavedAt}</p>
            <p className="sidebar-meta">Local backup: {lastBackupAt}</p>
            <p className="sidebar-meta">Current file: {lastFileName}</p>
            <p className="sidebar-meta">Local ID: {localProjectId}</p>
            <p className="sidebar-meta">Created: {createdAt ? new Date(createdAt).toLocaleString() : "Not set"}</p>
            <p className="sidebar-meta">Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "Not set"}</p>
            {projectStatus ? <p className="sidebar-status">{projectStatus}</p> : null}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default ProjectDetailsPage;
