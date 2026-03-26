function SectionCard({ title, description, children }) {
  return (
    <section className="section-card">
      {title || description ? (
        <div className="section-header">
          {title ? <h2>{title}</h2> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export default SectionCard;
