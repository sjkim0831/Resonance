/** Validation Rules */
export const required = (value) => value ? null : "Required";
export const minLength = (min) => (value) => value && value.length < min ? `Minimum ${min} chars` : null;
export const maxLength = (max) => (value) => value && value.length > max ? `Maximum ${max} chars` : null;
export const email = (value) => value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "Invalid email" : null;
export const phone = (value) => value && !/^\d{3}-\d{4}-\d{4}$/.test(value) ? "Format: 010-0000-0000" : null;

export const validateField = (value, validators) => {
  for (const v of validators) {
    const err = v(value);
    if (err) return err;
  }
  return null;
};

export const validateForm = (values, rules) => {
  const errors = {};
  for (const [field, validators] of Object.entries(rules)) {
    const err = validateField(values[field], validators);
    if (err) errors[field] = err;
  }
  return errors;
};