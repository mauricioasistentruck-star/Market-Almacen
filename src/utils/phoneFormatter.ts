// Formats Chilean mobile numbers enforcing the mandatory '+56 9 ' prefix
export function formatChilePhone(input: string): string {
  if (!input) return '+56 9 ';

  // Remove everything except numbers
  let digits = input.replace(/\D/g, '');

  // If it starts with 569, remove 569 to get the remaining 8 digits
  if (digits.startsWith('569')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('56')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('9') && digits.length > 8) {
    digits = digits.slice(1);
  }

  // Max 8 digits for the local number (e.g. 68191190)
  digits = digits.slice(0, 8);

  if (digits.length === 0) {
    return '+56 9 ';
  }

  if (digits.length <= 4) {
    return `+56 9 ${digits}`;
  }

  return `+56 9 ${digits.slice(0, 4)} ${digits.slice(4)}`;
}

export function cleanChilePhone(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 8) {
    const last8 = digits.slice(-8);
    return `+56 9 ${last8.slice(0, 4)} ${last8.slice(4)}`;
  }
  return input;
}
