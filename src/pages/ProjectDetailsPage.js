import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";

function ProjectDetailsPage({
  projectName,
  clientName,
  projectAddress,
  contactDetails,
  projectManager,
  estimator,
  revision,
  lastSavedAt,
  projectStatus,
  onProjectNameChange,
  onClientNameChange,
  onProjectAddressChange,
  onContactDetailsChange,
  onProjectManagerChange,
  onEstimatorChange,
  onRevisionChange,
  onSaveProject,
  onLoadProject,
  onResetProject,
}) {
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
            <button type="button" className="secondary-button" onClick={onLoadProject}>
              Load Project
            </button>
            <button type="button" className="danger-button" onClick={onResetProject}>
              New Project
            </button>
          </div>
        </div>

        <div className="library-table-panel">
          <div className="summary-section">
            <h3>Project Summary</h3>
            <p className="sidebar-meta">Last saved: {lastSavedAt}</p>
            {projectStatus ? <p className="sidebar-status">{projectStatus}</p> : null}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default ProjectDetailsPage;
