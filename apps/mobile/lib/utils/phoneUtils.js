// Phone number normalization utility
export const normalizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, try to detect country code
  if (!cleaned.startsWith('+')) {
    // French numbers handling (common case from your example)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      // 0602039126 -> +33602039126
      cleaned = '+33' + cleaned.substring(1);
    } else if (cleaned.startsWith('33') && cleaned.length === 11) {
      // 330602039126 -> +33602039126  
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 9) {
      // 602039126 -> +33602039126
      cleaned = '+33' + cleaned;
    } else if (cleaned.length === 10 && !cleaned.startsWith('0')) {
      // US numbers without country code
      cleaned = '+1' + cleaned;
    } else {
      // Default to adding + if missing
      cleaned = '+' + cleaned;
    }
  }
  
  // Remove any duplicate country code (like +3306... -> +336...)
  if (cleaned.startsWith('+33') && cleaned.length > 12) {
    // Check if there's an extra 0 after country code
    if (cleaned.charAt(3) === '0') {
      cleaned = '+33' + cleaned.substring(4);
    }
  }
  
  return cleaned;
};

// Phone number validation utility
export const validatePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return false;
  
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // Basic validation: should start with + and have at least 10 digits
  if (!normalized.startsWith('+')) return false;
  
  const digitsOnly = normalized.slice(1);
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
};

// Phone number formatting utility for display
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // French number formatting
  if (normalized.startsWith('+33') && normalized.length === 12) {
    const number = normalized.slice(3);
    return `+33 ${number.slice(0, 1)} ${number.slice(1, 3)} ${number.slice(3, 5)} ${number.slice(5, 7)} ${number.slice(7)}`;
  }
  
  // US number formatting
  if (normalized.startsWith('+1') && normalized.length === 12) {
    const number = normalized.slice(2);
    return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  }
  
  return normalized;
};

// Country codes data
export const getCountryCodes = () => {
  return [
    { id: 'fr', code: '+33', country: 'France', flag: '🇫🇷' },
    { id: 'us', code: '+1', country: 'United States', flag: '🇺🇸' },
    { id: 'ca', code: '+1', country: 'Canada', flag: '🇨🇦' },
    { id: 'gb', code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
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

// Test function to verify phone normalization
export const testPhoneNormalization = () => {
  const testCases = [
    '0602039126',      // French local -> +33602039126
    '330602039126',    // French with country code -> +33602039126
    '+33602039126',    // Already normalized -> +33602039126
    '+330602039126',   // Extra 0 -> +33602039126
    '602039126',       // Without leading 0 -> +33602039126
    '+33 06 02 03 91 26', // Formatted -> +33602039126
  ];
  
  console.log('📱 Testing phone normalization:');
  testCases.forEach(phone => {
    const normalized = normalizePhoneNumber(phone);
    console.log(`  "${phone}" -> "${normalized}"`);
  });
  
  return testCases.map(phone => ({
    input: phone,
    output: normalizePhoneNumber(phone)
  }));
}; 