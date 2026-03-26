function HomePage({ onStartProject, onViewDemo }) {
  const features = [
    {
      title: "Dynamic calculations",
      description: "Real-time totals as project inputs change.",
    },
    {
      title: "Assembly-based estimating",
      description: "Build once and reuse across every estimate.",
    },
    {
      title: "Labor and material clarity",
      description: "Track cost drivers without spreadsheet noise.",
    },
  ];

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-brand-lockup">
            <p className="home-brand-wordmark">Dynex</p>
            <p className="home-brand-tagline">dynamic estimating system</p>
          </div>

          <div className="home-hero-text">
            <h1>Build smarter estimates.</h1>
            <p>Cost, labor, and assemblies in one system.</p>
          </div>

          <div className="action-row home-hero-actions">
            <button type="button" className="primary-button" onClick={onStartProject}>
              Start Project
            </button>
            <button type="button" className="secondary-button" onClick={onViewDemo}>
              View Demo
            </button>
          </div>
        </div>

        <div className="home-preview-panel">
          <div className="home-preview-window">
            <div className="home-preview-metrics">
              <div className="home-preview-metric-card">
                <p>Total</p>
                <strong>$428,500</strong>
                <span className="is-positive">Ready to review</span>
              </div>
              <div className="home-preview-metric-card">
                <p>Labour</p>
                <strong>418 hrs</strong>
                <span>12 assemblies</span>
              </div>
            </div>

            <div className="home-preview-table">
              {[
                ["Bathrooms", "$84,200"],
                ["Kitchen", "$117,000"],
                ["Joinery Labour", "$32,100"],
              ].map((row) => (
                <div key={row[0]} className="home-preview-table-row">
                  <span>{row[0]}</span>
                  <span>{row[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-feature-strip">
        {features.map((feature) => (
          <div key={feature.title} className="home-feature-card">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </section>

      <section className="home-showcase">
        <div className="home-section-heading">
          <p>Preview</p>
          <h2>Clear cost structure at a glance.</h2>
        </div>

        <div className="home-showcase-grid">
          <div className="home-showcase-summary">
            <div className="home-summary-chip is-positive">Under budget</div>
            <div className="home-showcase-totals">
              <div>
                <p>Direct Cost</p>
                <strong>$356,200</strong>
              </div>
              <div>
                <p>Labour</p>
                <strong>418 hrs</strong>
              </div>
              <div>
                <p>Estimate Total</p>
                <strong>$428,500</strong>
              </div>
            </div>
          </div>

          <div className="home-showcase-table">
            <div className="home-showcase-row home-showcase-row-header">
              <span>Cost Row</span>
              <span>Status</span>
              <span>Total</span>
            </div>
            {[
              ["Bathrooms", "On track", "$84,200"],
              ["Kitchen Package", "Review", "$117,000"],
              ["Joinery Labour", "On track", "$32,100"],
              ["Preliminaries", "Review", "$18,950"],
            ].map(([name, status, total]) => (
              <div key={name} className="home-showcase-row">
                <span>{name}</span>
                <span className={status === "On track" ? "is-positive" : "is-warning"}>
                  {status}
                </span>
                <span>{total}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cta">
        <h2>Start building with Dynex.</h2>
        <button type="button" className="primary-button" onClick={onStartProject}>
          Create Project
        </button>
      </section>
    </div>
  );
}

export default HomePage;
