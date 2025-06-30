// Phone number validation utility
export const validatePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return false;
  
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Basic validation: should start with + and have at least 10 digits
  if (!cleaned.startsWith('+')) return false;
  
  const digitsOnly = cleaned.slice(1);
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
};

// Phone number formatting utility
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Simple formatting for display
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  if (cleaned.length < 4) return cleaned;
  
  // Basic US formatting as example
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    const number = cleaned.slice(2);
    return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  }
  
  return cleaned;
};

// Country codes data
export const getCountryCodes = () => {
  return [
    { id: 'us', code: '+1', country: 'United States', flag: '🇺🇸' },
    { id: 'ca', code: '+1', country: 'Canada', flag: '🇨🇦' },
    { id: 'gb', code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
    { id: 'fr', code: '+33', country: 'France', flag: '🇫🇷' },
    { id: 'de', code: '+49', country: 'Germany', flag: '🇩🇪' },
    { id: 'it', code: '+39', country: 'Italy', flag: '🇮🇹' },
    { id: 'es', code: '+34', country: 'Spain', flag: '🇪🇸' },
    { id: 'jp', code: '+81', country: 'Japan', flag: '🇯🇵' },
    { id: 'cn', code: '+86', country: 'China', flag: '🇨🇳' },
    { id: 'in', code: '+91', country: 'India', flag: '🇮🇳' },
    { id: 'au', code: '+61', country: 'Australia', flag: '🇦🇺' },
    { id: 'br', code: '+55', country: 'Brazil', flag: '🇧🇷' },
    { id: 'ru', code: '+7', country: 'Russia', flag: '🇷🇺' },
    { id: 'kr', code: '+82', country: 'South Korea', flag: '🇰🇷' },
    { id: 'mx', code: '+52', country: 'Mexico', flag: '🇲🇽' },
    { id: 'nl', code: '+31', country: 'Netherlands', flag: '🇳🇱' },
    { id: 'se', code: '+46', country: 'Sweden', flag: '🇸🇪' },
    { id: 'no', code: '+47', country: 'Norway', flag: '🇳🇴' },
    { id: 'dk', code: '+45', country: 'Denmark', flag: '🇩🇰' },
    { id: 'ch', code: '+41', country: 'Switzerland', flag: '🇨🇭' }
  ];
}; 