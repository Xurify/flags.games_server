// Comprehensive flag pattern data for similarity scoring and question generation
export const FLAG_COLOR_PATTERNS: { [key: string]: string[] } = {
  // Basic tricolor patterns
  redWhiteBlue: ["US", "GB", "FR", "NL", "RU", "CZ", "SK", "SI", "LU", "HR"],
  redWhiteGreen: ["IT", "BG", "HU", "IR", "BD", "MG"],
  blueWhiteRed: ["FR", "NL", "RU", "CZ", "SK", "SI", "LU", "HR"],
  greenWhiteRed: ["IT", "BG", "HU", "IR", "BD", "MG"],
  yellowBlueRed: ["RO", "TD", "AD", "CO", "EC", "VE"],
  redWhiteBlack: ["EG", "SY", "IQ", "YE", "SD", "SS"],
  greenYellowRed: ["GH", "CM", "GN", "ML", "SN", "BF", "NE", "TD", "TG", "BJ", "ET"],
  
  // Horizontal stripe patterns (commonly confused)
  redWhite: ["ID", "MC", "PL"],
  
  // Regional color schemes
  panArab: ["EG", "SY", "IQ", "YE", "SD", "SS"],
  andean: ["CO", "EC", "VE", "AR"],
  
};

export const FLAG_ELEMENTS: { [key: string]: string[] } = {
  stars: [
    "US", "AU", "NZ", "BR", "CN", "VN", "CU", "DO", "TT", "BB", "LC", "GD", "VC", "AG", "DM", "KN", "BS",
  ],
  crosses: ["SE", "NO", "DK", "FI", "IS", "GB", "CH", "GR"],
  stripes: [
    "US", "FR", "IT", "NL", "RU", "CZ", "SK", "SI", "LU", "TH", "MY", "ID", "PH", "SG",
    "BR", "AR", "CL", "CO", "PE", "VE", "UY", "PY", "BO", "EC", "GY", "SR", "CR", "PA",
    "NI", "HN", "SV", "GT", "BZ", "JM", "CU", "DO", "TT", "BB", "LC", "GD", "VC", "AG", "DM", "KN", "BS", "HT",
  ],
  circles: ["JP", "BD", "NP", "BN", "PW", "MH", "KI", "NR", "TV"],
  triangles: [
    "BA", "CZ", "SK", "SI", "LU", "TH", "MY", "ID", "PH", "SG", "BR", "AR", "CL", "CO", "PE", "VE", "UY", "PY", "BO", "EC", "GY", "SR", "CR", "PA", "NI", "HN", "SV", "GT", "BZ", "JM", "CU", "DO", "TT", "BB", "LC", "GD", "VC", "AG", "DM", "KN", "BS", "HT",
  ],
};

export const COMMON_SUFFIXES = ["land", "stan", "burg", "heim", "avia", "inia"];

export const GEOGRAPHIC_NEIGHBORS: { [key: string]: string[] } = {
  // Europe
  DE: ["FR", "IT", "AT", "CH", "BE", "NL", "DK", "PL", "CZ", "SK", "HU", "SI", "HR", "RS", "BA", "ME", "MK", "AL", "BG", "RO", "UA", "BY", "MD", "LV", "LT", "EE", "FI", "SE", "NO"],
  FR: ["DE", "IT", "ES", "BE", "NL", "CH", "AT", "GB", "IE"],
  IT: ["FR", "DE", "AT", "CH", "SI", "HR", "RS", "BA", "ME", "MK", "AL", "BG", "RO", "GR"],
  ES: ["FR", "PT", "MA", "DZ", "TN", "LY"],
  PL: ["DE", "CZ", "SK", "HU", "UA", "BY", "LT", "LV", "EE", "RU"],
  CZ: ["DE", "PL", "SK", "HU", "AT", "SI"],
  SK: ["CZ", "PL", "HU", "UA", "AT", "SI"],
  HU: ["SK", "CZ", "PL", "UA", "RO", "RS", "HR", "SI", "AT"],
  RO: ["HU", "UA", "MD", "BG", "RS", "BA", "ME", "MK", "AL"],
  BG: ["RO", "RS", "BA", "ME", "MK", "AL", "GR", "TR"],
  GR: ["BG", "AL", "MK", "ME", "TR"],
  TR: ["GR", "BG", "GE", "AM", "AZ", "IR", "IQ", "SY"],

  // Asia
  CN: ["RU", "MN", "KP", "KR", "JP", "VN", "LA", "MM", "IN", "PK", "AF", "TJ", "KG", "KZ"],
  JP: ["KR", "KP", "CN", "RU"],
  KR: ["KP", "JP", "CN"],
  KP: ["KR", "JP", "CN", "RU"],
  IN: ["PK", "CN", "NP", "BT", "BD", "MM", "LK", "MV"],
  PK: ["IN", "CN", "AF", "IR", "TJ", "KG", "KZ", "UZ", "TM"],
  AF: ["PK", "CN", "TJ", "KG", "UZ", "TM", "IR"],
  IR: ["PK", "AF", "TM", "UZ", "KG", "TJ", "AZ", "AM", "GE", "TR", "IQ"],
  SA: ["IQ", "JO", "AE", "QA", "KW", "BH", "OM", "YE"],

  // Africa
  EG: ["LY", "SD", "SS", "IL", "JO", "SA"],
  LY: ["EG", "TN", "DZ", "NE", "TD", "SD"],
  DZ: ["LY", "TN", "MA", "NE", "ML", "MR"],
  MA: ["DZ", "TN", "ES"],
  TN: ["LY", "DZ", "MA"],
  SD: ["EG", "LY", "TD", "CF", "CD", "SS", "ET", "ER"],
  SS: ["SD", "ET", "KE", "UG", "CD", "CF"],
  ET: ["SS", "SD", "ER", "DJ", "SO", "KE"],
  KE: ["SS", "ET", "SO", "UG", "TZ"],
  NG: ["NE", "TD", "CM", "GQ", "GA", "CG", "CD", "BI", "RW", "UG", "TZ", "MW", "MZ", "ZW", "BW", "NA", "GH", "CI", "SN", "ML", "BF", "GN", "GW", "SL", "LR", "GM", "MR", "CV", "ST"],

  // Americas
  US: ["CA", "MX"],
  CA: ["US"],
  MX: ["US", "GT", "BZ"],
  BR: ["GY", "SR", "VE", "CO", "PE", "BO", "PY", "AR", "UY"],
  AR: ["BR", "PY", "BO", "CL", "UY"],
  CL: ["AR", "BO", "PE"],
  CO: ["BR", "VE", "PE", "EC", "PA"],
  PE: ["BR", "CO", "EC", "BO", "CL"],
  VE: ["BR", "CO", "GY", "SR"],
  BO: ["BR", "AR", "CL", "PE", "PY"],
  PY: ["BR", "AR", "BO"],
  UY: ["BR", "AR"],
  EC: ["CO", "PE"],
  PA: ["CO", "CR"],
  CR: ["PA", "NI"],
  NI: ["CR", "HN"],
  HN: ["NI", "SV", "GT"],
  SV: ["HN", "GT"],
  GT: ["SV", "HN", "BZ", "MX"],
  BZ: ["GT", "MX"],
  JM: ["CU", "DO", "HT"],
  CU: ["JM", "DO", "HT"],
  DO: ["JM", "CU", "HT"],
  HT: ["JM", "CU", "DO"],
};

export const SUB_REGIONS: { [key: string]: string[] } = {
  scandinavia: ["SE", "NO", "DK", "FI", "IS"],
  baltics: ["EE", "LV", "LT"],
  balkans: ["HR", "SI", "RS", "BA", "ME", "MK", "AL", "BG", "RO", "XK"],
  centralEurope: ["CZ", "SK", "HU", "AT", "CH", "DE", "PL"],
  benelux: ["BE", "NL", "LU"],
  iberia: ["ES", "PT"],
  britishIsles: ["GB", "IE"],
  caucasus: ["AZ", "AM", "GE"],
  centralAsia: ["KZ", "UZ", "TM", "KG", "TJ"],
  hornOfAfrica: ["ET", "ER", "DJ", "SO"],
  westAfrica: ["GH", "CI", "SN", "ML", "BF", "NE", "TD", "TG", "BJ", "NG", "GN", "GW", "SL", "LR", "GM", "MR", "CV", "ST"],
  centralAfrica: ["CM", "CF", "CD", "CG", "GA", "GQ", "AO", "ZM", "ZW", "RW", "BI", "UG", "TZ", "MW", "MZ"],
  southernAfrica: ["ZA", "BW", "NA", "LS", "SZ", "MG", "MU", "SC", "KM"],
  caribbean: ["JM", "CU", "DO", "TT", "BB", "LC", "GD", "VC", "AG", "DM", "KN", "BS", "HT"],
  centralAmerica: ["GT", "BZ", "SV", "HN", "NI", "CR", "PA"],
  andes: ["CO", "EC", "PE", "BO", "CL", "AR"],
  southernCone: ["AR", "CL", "UY", "PY"],
  amazon: ["BR", "GY", "SR", "VE"],
  pacific: ["FJ", "PG", "SB", "VU", "WS", "TO", "PW", "FM", "MH", "KI", "NR", "TV"],
  southeastAsia: ["TH", "VN", "MY", "ID", "PH", "MM", "KH", "LA", "SG", "BN"],
  southAsia: ["IN", "PK", "BD", "LK", "NP", "BT", "MV", "AF"],
  eastAsia: ["CN", "JP", "KR", "KP", "MN", "TW"],
  middleEast: [
    "IL",
    "JO",
    "LB",
    "SY",
    "IQ",
    "IR",
    "SA",
    "AE",
    "QA",
    "KW",
    "BH",
    "OM",
    "YE",
    "TR",
    "PS",
  ],
  northAfrica: ["EG", "LY", "TN", "DZ", "MA", "SD", "SS"],
}; 

export const SIMILAR_FLAGS: { [key: string]: string[] } = {
  // Nearly identical flags
  RO: ["TD"], // Romania and Chad - almost identical blue-yellow-red vertical stripes
  TD: ["RO"],
  
  ID: ["MC", "PL"], // Red-white horizontal stripes
  MC: ["ID", "PL", "SG"], // Monaco and Indonesia are identical, Poland is inverted
  PL: ["ID", "MC", "SG", "CZ"], // Poland (white-red) vs Indonesia/Monaco (red-white)
  SG: ["ID", "MC", "PL"], // Singapore is similar but with a crescent/stars
  
  // Very similar red-white-red horizontal stripes
  LV: ["AT"], // Latvia and Austria - both red-white-red horizontal
  AT: ["LV"],

  // Nordic Cross flags - visually very similar cross designs
  DK: ["FI", "IS", "NO", "SE", "CH"], // Denmark
  FI: ["DK", "IS", "NO", "SE"], // Finland
  IS: ["DK", "FI", "NO", "SE"], // Iceland
  NO: ["DK", "FI", "IS", "SE"], // Norway
  SE: ["DK", "FI", "IS", "NO"], // Sweden
  
  // Vertical tricolors with similar patterns
  FR: ["NL", "LU", "PY", "RU"], // France (vertical) is often confused with horizontal tricolors
  IT: ["MX", "HU"], // Italy's vertical tricolor is confused with Mexico (emblem) and Hungary (horizontal)
  BE: ["DE"], // Black-yellow-red vertical vs horizontal
  IE: ["CI"], // Green-white-orange vertical vs Orange-white-green
  CI: ["IE"], // Orange-white-green vertical (reverse of Ireland)
  DE: ["BE"], // Black-red-yellow horizontal (similar colors to Belgium)
  MX: ["IT"], // Mexico is the same as Italy with a coat of arms
  
  // Horizontal tricolors
  NL: ["LU", "RU", "HR", "SK", "SI", "PY", "FR"], // Red-white-blue and similar horizontal stripes
  LU: ["NL", "RU", "HR", "PY", "FR"], // Red-white-blue horizontal (similar to The Netherlands)
  RU: ["NL", "LU", "SK", "SI", "PY", "FR"], // White-blue-red horizontal
  HR: ["NL", "LU", "SK", "SI", "PY"], // Red-white-blue with coat of arms
  SK: ["NL", "RU", "HR", "SI", "PY"], // White-blue-red horizontal
  SI: ["NL", "RU", "HR", "SK", "PY"], // White-blue-red horizontal
  PY: ["NL", "LU", "RU", "HR", "SK", "SI", "FR"], // Red-white-blue horizontal
  LI: ["HT"], // Liechtenstein and Haiti - blue over red with emblems
  HT: ["LI"], // Haiti and Liechtenstein
  
  // Pan-African colors (green-yellow-red in various arrangements)
  GH: ["BF", "BJ", "CM", "GN", "ML", "SN", "TG", "ET"], // Red-yellow-green horizontal with star
  BF: ["GH", "BJ", "CM", "GN", "ML", "SN", "TG"], // Red-white-green horizontal
  BJ: ["GH", "BF", "CM", "GN", "ML", "SN", "TG"], // Green-yellow-red horizontal
  CM: ["GH", "BF", "BJ", "GN", "ML", "SN", "TG"], // Green-red-yellow vertical
  GN: ["GH", "BF", "BJ", "CM", "ML", "SN", "TG"], // Red-yellow-green vertical
  ML: ["GH", "BF", "BJ", "CM", "GN", "SN", "TG"], // Green-yellow-red vertical
  SN: ["GH", "BF", "BJ", "CM", "GN", "ML", "TG"], // Green-yellow-red vertical with star
  TG: ["GH", "BF", "BJ", "CM", "GN", "ML", "SN"], // Green-yellow-red horizontal with star
  ET: ["GH"], // Green-yellow-red horizontal with emblem
  
  // Pan-Arab colors (red-white-black with green variations)
  AE: ["EG", "IQ", "JO", "KW", "SD", "SY", "YE", "PS"], // Red-white-black horizontal with green vertical
  EG: ["AE", "IQ", "JO", "SY", "YE", "PS"], // Red-white-black horizontal with eagle
  IQ: ["AE", "EG", "JO", "SY", "YE", "PS"], // Red-white-black horizontal with text
  JO: ["AE", "EG", "IQ", "SY", "YE", "PS"], // Black-white-green horizontal with triangle and star
  SY: ["AE", "EG", "IQ", "JO", "YE", "PS"], // Red-white-black horizontal with stars
  YE: ["AE", "EG", "IQ", "JO", "SY", "PS"], // Red-white-black horizontal
  SD: ["AE", "PS"], // Red-white-black horizontal with green triangle
  PS: ["AE", "EG", "IQ", "JO", "SY", "YE", "SD"], // Palestine - red-white-black horizontal with green triangle
  
  // Union Jack derivatives
  AU: ["NZ", "FJ"], // Blue field with Union Jack canton
  NZ: ["AU", "FJ"], // Blue field with Union Jack canton and stars
  FJ: ["AU", "NZ"], // Light blue field with Union Jack canton
  
  // Stars and Stripes pattern
  US: ["MY", "LR"], // Stars and stripes pattern
  MY: ["US", "LR"], // Red-white stripes with blue canton
  LR: ["US", "MY"], // Red-white stripes with blue canton
  
  // Crescent and star patterns
  TR: ["TN", "PK"], // Red field with crescent and star
  TN: ["TR", "PK"], // Red field with crescent and star
  PK: ["TR", "TN"], // Green field with crescent and star
  
  // Simple horizontal stripes - commonly confused
  UA: ["AR", "RW"], // Ukraine (blue-yellow) can be confused with Argentina's colors
  RW: ["UA"], // Rwanda has a similar blue/yellow scheme
  
  // Cross patterns (not Nordic) - commonly confused
  CH: ["DK", "GE"], // Square flag with cross
  GE: ["CH"], // White field with cross pattern
  
  // Green-white-red horizontal stripes
  HU: ["IT", "IR"], // Red-white-green horizontal
  IR: ["HU"], // Green-white-red horizontal
  
  // Blue-white patterns
  GR: ["IL", "UY"], // Blue-white stripes
  IL: ["GR", "UY"], // Blue-white stripes with star
  UY: ["GR", "IL"], // Blue-white stripes with sun
  
  // Complex but similar patterns - commonly confused
  IN: ["NE"], // Orange-white-green horizontal with wheel/emblem
  NE: ["IN"], // Orange-white-green horizontal
  
  // Commonly confused due to circle/sun symbols
  MK: ["KG"], // North Macedonia and Kyrgyzstan - red field with yellow sun
  KG: ["MK"],
  
  // Central American flags with similar blue-white-blue patterns
  GT: ["SV", "HN", "NI"], // Blue-white-blue vertical with emblem
  SV: ["GT", "HN", "NI"], // Blue-white-blue horizontal with emblem
  HN: ["GT", "SV", "NI"], // Blue-white-blue horizontal with emblem
  NI: ["GT", "SV", "HN"], // Blue-white-blue horizontal with emblem
  
  // South American flags with similar patterns
  AR: ["UY", "UA"], // Blue-white-blue horizontal with sun, similar colors to Ukraine
  BO: ["EC"], // Red-yellow-green horizontal with emblem
  EC: ["BO", "CO", "VE"], // Yellow-blue-red horizontal with emblem
  CO: ["EC", "VE"], // Yellow-blue-red horizontal
  VE: ["EC", "CO"], // Yellow-blue-red horizontal with stars
  
  // Light blue backgrounds with white stars - commonly confused
  SO: ["FM"], // Somalia (light blue with white star) vs Micronesia (light blue with 4 white stars)
  FM: ["SO"], // Micronesia (light blue with 4 white stars) vs Somalia (light blue with white star)
  
  // Light blue backgrounds with yellow circle/sun symbols - commonly confused
  PW: ["KZ"], // Palau (light blue with yellow circle) vs Kazakhstan (light blue with yellow sun)
  KZ: ["PW"], // Kazakhstan (light blue with yellow sun) vs Palau (light blue with yellow circle)

  // Other strong similarities
  QA: ["BH"], // Qatar and Bahrain - maroon/red and white with serrated edge
  BH: ["QA"],
  MD: ["AD"], // Moldova and Andorra - nearly identical tricolors with emblems
  AD: ["MD"],
  VU: ["ZA"], // Vanuatu and South Africa - both have a 'Y' shape
  ZA: ["VU"],
  VA: ["BN"], // Vatican City and Brunei - yellow and white themes with complex emblems
  BN: ["VA"],
  MU: ["AM"], // Mauritius and Armenia - similar horizontal tricolors
  AM: ["MU"],
  CZ: ["PL"], // Czech Rep. and Poland - identical white-over-red stripes

  // Groupings based on visual themes
  diagonalStripes: ["CD", "NA", "SC", "SB"],
  redFieldWithSymbol: ["CN", "VN", "TW"], // Red field with a prominent yellow star
  CN: ["VN", "TW"],
  VN: ["CN", "TW"],
  TW: ["CN", "VN"], // Taiwan - red field with blue canton and white sun
}; 

export const DISTINCTIVE_FLAGS: string[] = [
  // Most globally recognizable flags
  "US", // United States - stars and stripes (universally known)
  "GB", // United Kingdom - Union Jack (globally recognized)
  "JP", // Japan - red circle (extremely recognizable)
  "CA", // Canada - maple leaf (highly distinctive)
  "CH", // Switzerland - square with cross (unique shape)
  "IT", // Italy - green-white-red (very well known)
  "FR", // France - blue-white-red (globally recognized)
  "DE", // Germany - black-red-yellow (well known)
  "AU", // Australia - Union Jack with stars (recognizable)
  "BR", // Brazil - globe with stars (distinctive)
  "IN", // India - wheel symbol (recognizable)
  "CN", // China - red with stars (globally known)
  "RU", // Russia - white-blue-red (well known)
  "KR", // South Korea - yin-yang symbol (distinctive)
  "MX", // Mexico - eagle and snake (recognizable)
  "AR", // Argentina - sun symbol (well known)
  "ZA", // South Africa - unique Y-design (distinctive)
  "EG", // Egypt - eagle symbol (recognizable)
  "TR", // Turkey - crescent and star (well known)
  "SA", // Saudi Arabia - sword and text (distinctive)
];