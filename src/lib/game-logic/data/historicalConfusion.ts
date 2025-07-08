export const HISTORICAL_CONFUSION_PAIRS: { [key: string]: string[] } = {
  // Commonly confused pairs based on real user data
  SI: ["SK", "HR", "CZ", "RS"], // Slovenia often confused with Slovakia/Croatia/Czech Republic/Serbia
  SK: ["SI", "CZ", "HR", "RS"], // Slovakia with Slovenia/Czech Republic/Croatia/Serbia
  CZ: ["SK", "SI", "HR", "RS"], // Czech Republic with Slovakia/Slovenia/Croatia/Serbia
  HR: ["SI", "SK", "RS", "BA", "ME"], // Croatia with Slovenia/Slovakia/Serbia/Bosnia/Montenegro
  RS: ["SI", "SK", "HR", "BA", "ME", "MK", "XK"], // Serbia with Slovenia/Slovakia/Croatia/Bosnia/Montenegro/Macedonia/Kosovo
  BA: ["HR", "RS", "ME", "SI", "SK", "XK"], // Bosnia with Croatia/Serbia/Montenegro/Slovenia/Slovakia/Kosovo
  ME: ["HR", "RS", "BA", "SI", "SK", "XK"], // Montenegro with Croatia/Serbia/Bosnia/Slovenia/Slovakia/Kosovo
  MK: ["RS", "HR", "BA", "ME", "SI", "SK", "XK"], // Macedonia with Serbia/Croatia/Bosnia/Montenegro/Slovenia/Slovakia/Kosovo
  XK: ["RS", "HR", "BA", "ME", "MK", "SI", "SK"], // Kosovo with Serbia/Croatia/Bosnia/Montenegro/Macedonia/Slovenia/Slovakia
  LV: ["LT", "EE", "RU"], // Baltic confusion
  LT: ["LV", "EE", "RU"],
  EE: ["LV", "LT", "RU"],
  BY: ["RU", "UA", "PL"], // Eastern European confusion
  UA: ["BY", "RU", "PL"],
  PL: ["BY", "UA", "RU", "CZ", "SK"],
  GE: ["AM", "AZ", "TR"], // Caucasus confusion
  AM: ["GE", "AZ", "TR"],
  AZ: ["GE", "AM", "TR"],
  UZ: ["KZ", "TM", "KG", "TJ"], // Central Asian confusion
  KZ: ["UZ", "KG", "TM", "TJ"],
  TM: ["UZ", "TJ", "KZ", "KG"],
  KG: ["UZ", "KZ", "TJ", "TM"],
  TJ: ["UZ", "TM", "KG", "KZ"],
  // Nordic confusion
  SE: ["NO", "DK", "FI", "IS"],
  NO: ["SE", "DK", "FI", "IS"],
  DK: ["SE", "NO", "FI", "IS"],
  FI: ["SE", "NO", "DK", "IS"],
  IS: ["SE", "NO", "DK", "FI"],
  // Benelux confusion
  NL: ["LU", "BE", "DE"],
  LU: ["NL", "BE", "DE"],
  BE: ["NL", "LU", "DE"],
  // Iberian confusion
  ES: ["PT", "FR"],
  PT: ["ES", "FR"],
  // British Isles confusion
  GB: ["IE", "US"],
  IE: ["GB", "US"],
  // Middle Eastern confusion
  JO: ["AE", "KW", "SA", "QA", "BH", "OM", "PS"],
  AE: ["JO", "KW", "SA", "QA", "BH", "OM", "PS"],
  KW: ["JO", "AE", "SA", "QA", "BH", "OM", "PS"],
  SA: ["JO", "AE", "KW", "QA", "BH", "OM", "PS"],
  QA: ["JO", "AE", "KW", "SA", "BH", "OM", "PS"],
  BH: ["JO", "AE", "KW", "SA", "QA", "OM", "PS"],
  OM: ["JO", "AE", "KW", "SA", "QA", "BH", "PS"],
  PS: ["JO", "AE", "KW", "SA", "QA", "BH", "OM"], // Palestine with other Middle Eastern countries
  // African confusion
  GH: ["CM", "GN", "ML", "SN", "BF", "NE"],
  CM: ["GH", "GN", "ML", "SN", "BF", "NE"],
  GN: ["GH", "CM", "ML", "SN", "BF", "NE"],
  ML: ["GH", "CM", "GN", "SN", "BF", "NE"],
  SN: ["GH", "CM", "GN", "ML", "BF", "NE"],
  BF: ["GH", "CM", "GN", "ML", "SN", "NE"],
  NE: ["IN", "IE", "CI", "TD"],
  IQ: ["JO", "AE", "KW", "SD", "SY", "IR", "SA", "QA", "BH", "OM", "YE", "PS"],
  // East Asian confusion
  TW: ["CN", "JP", "KR", "KP"], // Taiwan often confused with China/Japan/Korea
  CN: ["TW", "JP", "KR", "KP"], // China with Taiwan/Japan/Korea
}; 