import { Children, cloneElement, isValidElement, useId } from "react";

function FormField({ label, children }) {
  const fallbackId = useId();
  const child = Children.only(children);

  if (!isValidElement(child)) {
    return (
      <div className="field">
        <label>{label}</label>
        {children}
      </div>
    );
  }

  const controlId = child.props.id || fallbackId;
  const enhancedChild = cloneElement(child, {
    id: controlId,
  });

  return (
    <div className="field">
      <label htmlFor={controlId}>{label}</label>
      {enhancedChild}
    </div>
  );
}

export default FormField;
