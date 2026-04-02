function SectionCard({ title, description, children, className = "" }) {
  return (
    <section className={["section-card", className].filter(Boolean).join(" ")}>
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
