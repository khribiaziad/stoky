// Phone: must be 10 digits starting with 06 or 07 (Moroccan mobile)
export function validatePhone(value) {
  if (!value) return 'Phone number is required';
  const digits = value.replace(/\s/g, '');
  if (!/^\d{10}$/.test(digits)) return 'Phone must be 10 digits';
  if (!/^0[67]/.test(digits)) return 'Phone must start with 06 or 07';
  return null;
}

// Amount: must be a positive number
export function validateAmount(value) {
  if (value === '' || value === null || value === undefined) return 'Amount is required';
  const n = Number(value);
  if (isNaN(n)) return 'Amount must be a number';
  if (n <= 0) return 'Amount must be greater than 0';
  return null;
}

// Required: non-empty string
export function validateRequired(value, label = 'This field') {
  if (!value || String(value).trim() === '') return `${label} is required`;
  return null;
}

// Email format
export function validateEmail(value) {
  if (!value) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email address';
  return null;
}

// keyDown handler: block non-numeric keys on numeric-only fields
export function numericOnly(e) {
  if (e.ctrlKey || e.metaKey) return; // allow Ctrl/Cmd+A, C, V, X, Z
  const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
  if (allowed.includes(e.key)) return;
  if (!/^\d$/.test(e.key)) e.preventDefault();
}

// Validate multiple fields at once; returns fieldErrors object
// rules: { fieldName: (value) => errorString | null }
export function validateFields(values, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const err = rule(values[field]);
    if (err) errors[field] = err;
  }
  return errors;
}

// Inline error style for use under form fields
export const fieldErrorStyle = {
  color: '#f87171',
  fontSize: 11,
  marginTop: 3,
};
