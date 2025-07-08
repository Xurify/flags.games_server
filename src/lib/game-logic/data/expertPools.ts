export const EXPERT_COUNTRY_POOLS: { [key: string]: string[] } = {
    // Countries with very similar flags (high confusion)
    confusingFlags: [
      "NL", "LU", "RU", "SI", "SK", "CZ", "FR", // Similar tricolors
      "ID", "MC", "PL", // Red-white patterns
      "TD", "RO", "AD", // Blue-yellow-red
      "SE", "NO", "DK", "FI", "IS", // Nordic crosses
      "HR", "RS", "BA", "ME", "MK", "XK", // Balkan similarities
    ],
    
    // Countries with confusing names
    confusingNames: [
      "GN", "GW", "GQ", // Guinea variants
      "CG", "CD", // Congo variants
      "KP", "KR", // Korea variants
      "US", "GB", "AE", // "United" countries
    ],
    
    // Lesser-known countries that are often confused
    lesserKnown: [
      "SM", "AD", "LI", "MT", "CY", // Small European
      "BT", "MV", "TL", "BN", // Small Asian
      "KI", "NR", "TV", "PW", "FM", "MH", // Pacific islands
      "ST", "CV", "KM", "SC", "MU", // Small African islands
      "LC", "VC", "GD", "DM", "KN", "AG", "BB", // Caribbean
      "XK", "PS", // Kosovo and Palestine
    ],
  
    // Regional flag patterns (for both similarity and question generation)
    panAfrican: ["GH", "CM", "GN", "ML", "SN", "BF", "NE", "TD", "TG", "BJ", "ET"],
    panArab: ["JO", "AE", "KW", "SD", "SY", "IQ", "YE", "PS"],
    nordic: ["SE", "NO", "DK", "FI", "IS"],
    caribbean: ["JM", "CU", "DO", "TT", "BB", "LC", "GD", "VC"],
  };