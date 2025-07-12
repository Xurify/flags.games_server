import { Difficulty } from '../../constants';
import { countries } from './countries';

// Easy: Well-known, distinctive flags that are easily recognizable
export const easyCountries = countries.filter(country => 
  ['US', 'CA', 'GB', 'FR', 'DE', 'IT', 'ES', 'AU', 'JP', 'CN', 'IN', 'BR', 'MX', 'RU', 'KR', 'NL', 'CH', 'SE', 'NO', 'DK', 'FI', 'TR', 'EG', 'ZA', 'AR', 'CL', 'TH', 'SG', 'NZ', 'IE'].includes(country.code)
);

// Medium: Mix of recognizable and less common flags
export const mediumCountries = countries.filter(country => 
  ['BE', 'AT', 'PL', 'PT', 'GR', 'NG', 'KE', 'MA', 'CO', 'PE', 'VE', 'VN', 'MY', 'ID', 'PH', 'IS', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'EE', 'LV', 'LT', 'UA', 'RS', 'IL', 'JO', 'LB', 'SA', 'AE', 'QA', 'KW', 'PK', 'BD', 'LK', 'NP', 'MM', 'KH', 'LA', 'MN', 'KZ', 'UZ', 'GE', 'DZ', 'TN', 'LY', 'SD', 'ET', 'GH', 'CI', 'SN', 'CM', 'AO', 'ZM', 'ZW', 'BW', 'NA', 'MG', 'UY', 'PY', 'BO', 'EC', 'CR', 'PA', 'JM', 'CU', 'DO', 'FJ', 'PG'].includes(country.code)
);

// Hard: Lesser-known countries and flags that are similar to others
export const hardCountries = countries.filter(country => 
  !easyCountries.find(easyCountry => easyCountry.code === country.code) && 
  !mediumCountries.find(mediumCountry => mediumCountry.code === country.code)
);

export const getDifficultyCountries = (difficulty: Difficulty) => {
  switch (difficulty) {
    case 'easy':
      return easyCountries;
    case 'medium':
      return [...easyCountries, ...mediumCountries];
    case 'hard':
    case 'expert':
      return countries;
    default:
      return easyCountries;
  }
};
