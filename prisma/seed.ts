import { PrismaClient, Continent, BidStatus, PaymentStatus, ActivityType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Country Data ─────────────────────────────────────────────────────────────

interface CountryData {
  name: string;
  officialName: string;
  isoCode: string;
  iso3Code: string;
  flag: string;
  continent: Continent;
  currency: string;
  description?: string;
}

const countries: CountryData[] = [
  // ─── Asia ───────────────────────────────────────────────────────────────────
  { name: 'Afghanistan', officialName: 'Islamic Emirate of Afghanistan', isoCode: 'AF', iso3Code: 'AFG', flag: '🇦🇫', continent: 'Asia', currency: 'AFN' },
  { name: 'Armenia', officialName: 'Republic of Armenia', isoCode: 'AM', iso3Code: 'ARM', flag: '🇦🇲', continent: 'Asia', currency: 'AMD' },
  { name: 'Azerbaijan', officialName: 'Republic of Azerbaijan', isoCode: 'AZ', iso3Code: 'AZE', flag: '🇦🇿', continent: 'Asia', currency: 'AZN' },
  { name: 'Bahrain', officialName: 'Kingdom of Bahrain', isoCode: 'BH', iso3Code: 'BHR', flag: '🇧🇭', continent: 'Asia', currency: 'BHD' },
  { name: 'Bangladesh', officialName: "People's Republic of Bangladesh", isoCode: 'BD', iso3Code: 'BGD', flag: '🇧🇩', continent: 'Asia', currency: 'BDT' },
  { name: 'Bhutan', officialName: 'Kingdom of Bhutan', isoCode: 'BT', iso3Code: 'BTN', flag: '🇧🇹', continent: 'Asia', currency: 'BTN' },
  { name: 'Brunei', officialName: 'Nation of Brunei, the Abode of Peace', isoCode: 'BN', iso3Code: 'BRN', flag: '🇧🇳', continent: 'Asia', currency: 'BND' },
  { name: 'Cambodia', officialName: 'Kingdom of Cambodia', isoCode: 'KH', iso3Code: 'KHM', flag: '🇰🇭', continent: 'Asia', currency: 'KHR' },
  { name: 'China', officialName: "People's Republic of China", isoCode: 'CN', iso3Code: 'CHN', flag: '🇨🇳', continent: 'Asia', currency: 'CNY', description: 'The world\'s most populous nation and second-largest economy.' },
  { name: 'Cyprus', officialName: 'Republic of Cyprus', isoCode: 'CY', iso3Code: 'CYP', flag: '🇨🇾', continent: 'Asia', currency: 'EUR' },
  { name: 'Georgia', officialName: 'Georgia', isoCode: 'GE', iso3Code: 'GEO', flag: '🇬🇪', continent: 'Asia', currency: 'GEL' },
  { name: 'India', officialName: 'Republic of India', isoCode: 'IN', iso3Code: 'IND', flag: '🇮🇳', continent: 'Asia', currency: 'INR', description: 'Home to 1.4 billion people and a rapidly growing tech economy.' },
  { name: 'Indonesia', officialName: 'Republic of Indonesia', isoCode: 'ID', iso3Code: 'IDN', flag: '🇮🇩', continent: 'Asia', currency: 'IDR' },
  { name: 'Iran', officialName: 'Islamic Republic of Iran', isoCode: 'IR', iso3Code: 'IRN', flag: '🇮🇷', continent: 'Asia', currency: 'IRR' },
  { name: 'Iraq', officialName: 'Republic of Iraq', isoCode: 'IQ', iso3Code: 'IRQ', flag: '🇮🇶', continent: 'Asia', currency: 'IQD' },
  { name: 'Israel', officialName: 'State of Israel', isoCode: 'IL', iso3Code: 'ISR', flag: '🇮🇱', continent: 'Asia', currency: 'ILS' },
  { name: 'Japan', officialName: 'Japan', isoCode: 'JP', iso3Code: 'JPN', flag: '🇯🇵', continent: 'Asia', currency: 'JPY', description: 'Land of the rising sun — a global leader in technology and culture.' },
  { name: 'Jordan', officialName: 'Hashemite Kingdom of Jordan', isoCode: 'JO', iso3Code: 'JOR', flag: '🇯🇴', continent: 'Asia', currency: 'JOD' },
  { name: 'Kazakhstan', officialName: 'Republic of Kazakhstan', isoCode: 'KZ', iso3Code: 'KAZ', flag: '🇰🇿', continent: 'Asia', currency: 'KZT' },
  { name: 'Kuwait', officialName: 'State of Kuwait', isoCode: 'KW', iso3Code: 'KWT', flag: '🇰🇼', continent: 'Asia', currency: 'KWD' },
  { name: 'Kyrgyzstan', officialName: 'Kyrgyz Republic', isoCode: 'KG', iso3Code: 'KGZ', flag: '🇰🇬', continent: 'Asia', currency: 'KGS' },
  { name: 'Laos', officialName: "Lao People's Democratic Republic", isoCode: 'LA', iso3Code: 'LAO', flag: '🇱🇦', continent: 'Asia', currency: 'LAK' },
  { name: 'Lebanon', officialName: 'Lebanese Republic', isoCode: 'LB', iso3Code: 'LBN', flag: '🇱🇧', continent: 'Asia', currency: 'LBP' },
  { name: 'Malaysia', officialName: 'Malaysia', isoCode: 'MY', iso3Code: 'MYS', flag: '🇲🇾', continent: 'Asia', currency: 'MYR' },
  { name: 'Maldives', officialName: 'Republic of Maldives', isoCode: 'MV', iso3Code: 'MDV', flag: '🇲🇻', continent: 'Asia', currency: 'MVR' },
  { name: 'Mongolia', officialName: 'Mongolia', isoCode: 'MN', iso3Code: 'MNG', flag: '🇲🇳', continent: 'Asia', currency: 'MNT' },
  { name: 'Myanmar', officialName: 'Republic of the Union of Myanmar', isoCode: 'MM', iso3Code: 'MMR', flag: '🇲🇲', continent: 'Asia', currency: 'MMK' },
  { name: 'Nepal', officialName: 'Federal Democratic Republic of Nepal', isoCode: 'NP', iso3Code: 'NPL', flag: '🇳🇵', continent: 'Asia', currency: 'NPR' },
  { name: 'North Korea', officialName: "Democratic People's Republic of Korea", isoCode: 'KP', iso3Code: 'PRK', flag: '🇰🇵', continent: 'Asia', currency: 'KPW' },
  { name: 'Oman', officialName: 'Sultanate of Oman', isoCode: 'OM', iso3Code: 'OMN', flag: '🇴🇲', continent: 'Asia', currency: 'OMR' },
  { name: 'Pakistan', officialName: 'Islamic Republic of Pakistan', isoCode: 'PK', iso3Code: 'PAK', flag: '🇵🇰', continent: 'Asia', currency: 'PKR' },
  { name: 'Palestine', officialName: 'State of Palestine', isoCode: 'PS', iso3Code: 'PSE', flag: '🇵🇸', continent: 'Asia', currency: 'ILS' },
  { name: 'Philippines', officialName: 'Republic of the Philippines', isoCode: 'PH', iso3Code: 'PHL', flag: '🇵🇭', continent: 'Asia', currency: 'PHP' },
  { name: 'Qatar', officialName: 'State of Qatar', isoCode: 'QA', iso3Code: 'QAT', flag: '🇶🇦', continent: 'Asia', currency: 'QAR' },
  { name: 'Saudi Arabia', officialName: 'Kingdom of Saudi Arabia', isoCode: 'SA', iso3Code: 'SAU', flag: '🇸🇦', continent: 'Asia', currency: 'SAR' },
  { name: 'Singapore', officialName: 'Republic of Singapore', isoCode: 'SG', iso3Code: 'SGP', flag: '🇸🇬', continent: 'Asia', currency: 'SGD' },
  { name: 'South Korea', officialName: 'Republic of Korea', isoCode: 'KR', iso3Code: 'KOR', flag: '🇰🇷', continent: 'Asia', currency: 'KRW', description: 'K-culture powerhouse and tech giant of East Asia.' },
  { name: 'Sri Lanka', officialName: 'Democratic Socialist Republic of Sri Lanka', isoCode: 'LK', iso3Code: 'LKA', flag: '🇱🇰', continent: 'Asia', currency: 'LKR' },
  { name: 'Syria', officialName: 'Syrian Arab Republic', isoCode: 'SY', iso3Code: 'SYR', flag: '🇸🇾', continent: 'Asia', currency: 'SYP' },
  { name: 'Taiwan', officialName: 'Republic of China (Taiwan)', isoCode: 'TW', iso3Code: 'TWN', flag: '🇹🇼', continent: 'Asia', currency: 'TWD' },
  { name: 'Tajikistan', officialName: 'Republic of Tajikistan', isoCode: 'TJ', iso3Code: 'TJK', flag: '🇹🇯', continent: 'Asia', currency: 'TJS' },
  { name: 'Thailand', officialName: 'Kingdom of Thailand', isoCode: 'TH', iso3Code: 'THA', flag: '🇹🇭', continent: 'Asia', currency: 'THB' },
  { name: 'Timor-Leste', officialName: 'Democratic Republic of Timor-Leste', isoCode: 'TL', iso3Code: 'TLS', flag: '🇹🇱', continent: 'Asia', currency: 'USD' },
  { name: 'Turkey', officialName: 'Republic of Turkey', isoCode: 'TR', iso3Code: 'TUR', flag: '🇹🇷', continent: 'Asia', currency: 'TRY' },
  { name: 'Turkmenistan', officialName: 'Turkmenistan', isoCode: 'TM', iso3Code: 'TKM', flag: '🇹🇲', continent: 'Asia', currency: 'TMT' },
  { name: 'United Arab Emirates', officialName: 'United Arab Emirates', isoCode: 'AE', iso3Code: 'ARE', flag: '🇦🇪', continent: 'Asia', currency: 'AED' },
  { name: 'Uzbekistan', officialName: 'Republic of Uzbekistan', isoCode: 'UZ', iso3Code: 'UZB', flag: '🇺🇿', continent: 'Asia', currency: 'UZS' },
  { name: 'Vietnam', officialName: 'Socialist Republic of Vietnam', isoCode: 'VN', iso3Code: 'VNM', flag: '🇻🇳', continent: 'Asia', currency: 'VND' },
  { name: 'Yemen', officialName: 'Republic of Yemen', isoCode: 'YE', iso3Code: 'YEM', flag: '🇾🇪', continent: 'Asia', currency: 'YER' },

  // ─── Europe ─────────────────────────────────────────────────────────────────
  { name: 'Albania', officialName: 'Republic of Albania', isoCode: 'AL', iso3Code: 'ALB', flag: '🇦🇱', continent: 'Europe', currency: 'ALL' },
  { name: 'Andorra', officialName: 'Principality of Andorra', isoCode: 'AD', iso3Code: 'AND', flag: '🇦🇩', continent: 'Europe', currency: 'EUR' },
  { name: 'Austria', officialName: 'Republic of Austria', isoCode: 'AT', iso3Code: 'AUT', flag: '🇦🇹', continent: 'Europe', currency: 'EUR' },
  { name: 'Belarus', officialName: 'Republic of Belarus', isoCode: 'BY', iso3Code: 'BLR', flag: '🇧🇾', continent: 'Europe', currency: 'BYN' },
  { name: 'Belgium', officialName: 'Kingdom of Belgium', isoCode: 'BE', iso3Code: 'BEL', flag: '🇧🇪', continent: 'Europe', currency: 'EUR' },
  { name: 'Bosnia and Herzegovina', officialName: 'Bosnia and Herzegovina', isoCode: 'BA', iso3Code: 'BIH', flag: '🇧🇦', continent: 'Europe', currency: 'BAM' },
  { name: 'Bulgaria', officialName: 'Republic of Bulgaria', isoCode: 'BG', iso3Code: 'BGR', flag: '🇧🇬', continent: 'Europe', currency: 'BGN' },
  { name: 'Croatia', officialName: 'Republic of Croatia', isoCode: 'HR', iso3Code: 'HRV', flag: '🇭🇷', continent: 'Europe', currency: 'EUR' },
  { name: 'Czech Republic', officialName: 'Czech Republic', isoCode: 'CZ', iso3Code: 'CZE', flag: '🇨🇿', continent: 'Europe', currency: 'CZK' },
  { name: 'Denmark', officialName: 'Kingdom of Denmark', isoCode: 'DK', iso3Code: 'DNK', flag: '🇩🇰', continent: 'Europe', currency: 'DKK' },
  { name: 'Estonia', officialName: 'Republic of Estonia', isoCode: 'EE', iso3Code: 'EST', flag: '🇪🇪', continent: 'Europe', currency: 'EUR' },
  { name: 'Finland', officialName: 'Republic of Finland', isoCode: 'FI', iso3Code: 'FIN', flag: '🇫🇮', continent: 'Europe', currency: 'EUR' },
  { name: 'France', officialName: 'French Republic', isoCode: 'FR', iso3Code: 'FRA', flag: '🇫🇷', continent: 'Europe', currency: 'EUR', description: 'The cultural capital of the world and heart of European civilization.' },
  { name: 'Germany', officialName: 'Federal Republic of Germany', isoCode: 'DE', iso3Code: 'DEU', flag: '🇩🇪', continent: 'Europe', currency: 'EUR', description: 'Europe\'s largest economy and engineering powerhouse.' },
  { name: 'Greece', officialName: 'Hellenic Republic', isoCode: 'GR', iso3Code: 'GRC', flag: '🇬🇷', continent: 'Europe', currency: 'EUR' },
  { name: 'Hungary', officialName: 'Hungary', isoCode: 'HU', iso3Code: 'HUN', flag: '🇭🇺', continent: 'Europe', currency: 'HUF' },
  { name: 'Iceland', officialName: 'Iceland', isoCode: 'IS', iso3Code: 'ISL', flag: '🇮🇸', continent: 'Europe', currency: 'ISK' },
  { name: 'Ireland', officialName: 'Ireland', isoCode: 'IE', iso3Code: 'IRL', flag: '🇮🇪', continent: 'Europe', currency: 'EUR' },
  { name: 'Italy', officialName: 'Italian Republic', isoCode: 'IT', iso3Code: 'ITA', flag: '🇮🇹', continent: 'Europe', currency: 'EUR', description: 'Birthplace of the Renaissance and home of la dolce vita.' },
  { name: 'Kosovo', officialName: 'Republic of Kosovo', isoCode: 'XK', iso3Code: 'XKX', flag: '🇽🇰', continent: 'Europe', currency: 'EUR' },
  { name: 'Latvia', officialName: 'Republic of Latvia', isoCode: 'LV', iso3Code: 'LVA', flag: '🇱🇻', continent: 'Europe', currency: 'EUR' },
  { name: 'Liechtenstein', officialName: 'Principality of Liechtenstein', isoCode: 'LI', iso3Code: 'LIE', flag: '🇱🇮', continent: 'Europe', currency: 'CHF' },
  { name: 'Lithuania', officialName: 'Republic of Lithuania', isoCode: 'LT', iso3Code: 'LTU', flag: '🇱🇹', continent: 'Europe', currency: 'EUR' },
  { name: 'Luxembourg', officialName: 'Grand Duchy of Luxembourg', isoCode: 'LU', iso3Code: 'LUX', flag: '🇱🇺', continent: 'Europe', currency: 'EUR' },
  { name: 'Malta', officialName: 'Republic of Malta', isoCode: 'MT', iso3Code: 'MLT', flag: '🇲🇹', continent: 'Europe', currency: 'EUR' },
  { name: 'Moldova', officialName: 'Republic of Moldova', isoCode: 'MD', iso3Code: 'MDA', flag: '🇲🇩', continent: 'Europe', currency: 'MDL' },
  { name: 'Monaco', officialName: 'Principality of Monaco', isoCode: 'MC', iso3Code: 'MCO', flag: '🇲🇨', continent: 'Europe', currency: 'EUR' },
  { name: 'Montenegro', officialName: 'Montenegro', isoCode: 'ME', iso3Code: 'MNE', flag: '🇲🇪', continent: 'Europe', currency: 'EUR' },
  { name: 'Netherlands', officialName: 'Kingdom of the Netherlands', isoCode: 'NL', iso3Code: 'NLD', flag: '🇳🇱', continent: 'Europe', currency: 'EUR' },
  { name: 'North Macedonia', officialName: 'Republic of North Macedonia', isoCode: 'MK', iso3Code: 'MKD', flag: '🇲🇰', continent: 'Europe', currency: 'MKD' },
  { name: 'Norway', officialName: 'Kingdom of Norway', isoCode: 'NO', iso3Code: 'NOR', flag: '🇳🇴', continent: 'Europe', currency: 'NOK' },
  { name: 'Poland', officialName: 'Republic of Poland', isoCode: 'PL', iso3Code: 'POL', flag: '🇵🇱', continent: 'Europe', currency: 'PLN' },
  { name: 'Portugal', officialName: 'Portuguese Republic', isoCode: 'PT', iso3Code: 'PRT', flag: '🇵🇹', continent: 'Europe', currency: 'EUR' },
  { name: 'Romania', officialName: 'Romania', isoCode: 'RO', iso3Code: 'ROU', flag: '🇷🇴', continent: 'Europe', currency: 'RON' },
  { name: 'Russia', officialName: 'Russian Federation', isoCode: 'RU', iso3Code: 'RUS', flag: '🇷🇺', continent: 'Europe', currency: 'RUB', description: 'The world\'s largest country by landmass, spanning 11 time zones.' },
  { name: 'San Marino', officialName: 'Republic of San Marino', isoCode: 'SM', iso3Code: 'SMR', flag: '🇸🇲', continent: 'Europe', currency: 'EUR' },
  { name: 'Serbia', officialName: 'Republic of Serbia', isoCode: 'RS', iso3Code: 'SRB', flag: '🇷🇸', continent: 'Europe', currency: 'RSD' },
  { name: 'Slovakia', officialName: 'Slovak Republic', isoCode: 'SK', iso3Code: 'SVK', flag: '🇸🇰', continent: 'Europe', currency: 'EUR' },
  { name: 'Slovenia', officialName: 'Republic of Slovenia', isoCode: 'SI', iso3Code: 'SVN', flag: '🇸🇮', continent: 'Europe', currency: 'EUR' },
  { name: 'Spain', officialName: 'Kingdom of Spain', isoCode: 'ES', iso3Code: 'ESP', flag: '🇪🇸', continent: 'Europe', currency: 'EUR', description: 'Land of passion, flamenco, and world-class football.' },
  { name: 'Sweden', officialName: 'Kingdom of Sweden', isoCode: 'SE', iso3Code: 'SWE', flag: '🇸🇪', continent: 'Europe', currency: 'SEK' },
  { name: 'Switzerland', officialName: 'Swiss Confederation', isoCode: 'CH', iso3Code: 'CHE', flag: '🇨🇭', continent: 'Europe', currency: 'CHF' },
  { name: 'Ukraine', officialName: 'Ukraine', isoCode: 'UA', iso3Code: 'UKR', flag: '🇺🇦', continent: 'Europe', currency: 'UAH' },
  { name: 'United Kingdom', officialName: 'United Kingdom of Great Britain and Northern Ireland', isoCode: 'GB', iso3Code: 'GBR', flag: '🇬🇧', continent: 'Europe', currency: 'GBP', description: 'Global cultural trendsetter and home of the Premier League.' },
  { name: 'Vatican City', officialName: 'Vatican City State', isoCode: 'VA', iso3Code: 'VAT', flag: '🇻🇦', continent: 'Europe', currency: 'EUR' },

  // ─── Africa ─────────────────────────────────────────────────────────────────
  { name: 'Algeria', officialName: "People's Democratic Republic of Algeria", isoCode: 'DZ', iso3Code: 'DZA', flag: '🇩🇿', continent: 'Africa', currency: 'DZD' },
  { name: 'Angola', officialName: 'Republic of Angola', isoCode: 'AO', iso3Code: 'AGO', flag: '🇦🇴', continent: 'Africa', currency: 'AOA' },
  { name: 'Benin', officialName: 'Republic of Benin', isoCode: 'BJ', iso3Code: 'BEN', flag: '🇧🇯', continent: 'Africa', currency: 'XOF' },
  { name: 'Botswana', officialName: 'Republic of Botswana', isoCode: 'BW', iso3Code: 'BWA', flag: '🇧🇼', continent: 'Africa', currency: 'BWP' },
  { name: 'Burkina Faso', officialName: 'Burkina Faso', isoCode: 'BF', iso3Code: 'BFA', flag: '🇧🇫', continent: 'Africa', currency: 'XOF' },
  { name: 'Burundi', officialName: 'Republic of Burundi', isoCode: 'BI', iso3Code: 'BDI', flag: '🇧🇮', continent: 'Africa', currency: 'BIF' },
  { name: 'Cameroon', officialName: 'Republic of Cameroon', isoCode: 'CM', iso3Code: 'CMR', flag: '🇨🇲', continent: 'Africa', currency: 'XAF' },
  { name: 'Cape Verde', officialName: 'Republic of Cabo Verde', isoCode: 'CV', iso3Code: 'CPV', flag: '🇨🇻', continent: 'Africa', currency: 'CVE' },
  { name: 'Central African Republic', officialName: 'Central African Republic', isoCode: 'CF', iso3Code: 'CAF', flag: '🇨🇫', continent: 'Africa', currency: 'XAF' },
  { name: 'Chad', officialName: 'Republic of Chad', isoCode: 'TD', iso3Code: 'TCD', flag: '🇹🇩', continent: 'Africa', currency: 'XAF' },
  { name: 'Comoros', officialName: 'Union of the Comoros', isoCode: 'KM', iso3Code: 'COM', flag: '🇰🇲', continent: 'Africa', currency: 'KMF' },
  { name: 'DR Congo', officialName: 'Democratic Republic of the Congo', isoCode: 'CD', iso3Code: 'COD', flag: '🇨🇩', continent: 'Africa', currency: 'CDF' },
  { name: 'Republic of Congo', officialName: 'Republic of the Congo', isoCode: 'CG', iso3Code: 'COG', flag: '🇨🇬', continent: 'Africa', currency: 'XAF' },
  { name: 'Djibouti', officialName: 'Republic of Djibouti', isoCode: 'DJ', iso3Code: 'DJI', flag: '🇩🇯', continent: 'Africa', currency: 'DJF' },
  { name: 'Egypt', officialName: 'Arab Republic of Egypt', isoCode: 'EG', iso3Code: 'EGY', flag: '🇪🇬', continent: 'Africa', currency: 'EGP' },
  { name: 'Equatorial Guinea', officialName: 'Republic of Equatorial Guinea', isoCode: 'GQ', iso3Code: 'GNQ', flag: '🇬🇶', continent: 'Africa', currency: 'XAF' },
  { name: 'Eritrea', officialName: 'State of Eritrea', isoCode: 'ER', iso3Code: 'ERI', flag: '🇪🇷', continent: 'Africa', currency: 'ERN' },
  { name: 'Eswatini', officialName: 'Kingdom of Eswatini', isoCode: 'SZ', iso3Code: 'SWZ', flag: '🇸🇿', continent: 'Africa', currency: 'SZL' },
  { name: 'Ethiopia', officialName: 'Federal Democratic Republic of Ethiopia', isoCode: 'ET', iso3Code: 'ETH', flag: '🇪🇹', continent: 'Africa', currency: 'ETB' },
  { name: 'Gabon', officialName: 'Gabonese Republic', isoCode: 'GA', iso3Code: 'GAB', flag: '🇬🇦', continent: 'Africa', currency: 'XAF' },
  { name: 'Gambia', officialName: 'Republic of The Gambia', isoCode: 'GM', iso3Code: 'GMB', flag: '🇬🇲', continent: 'Africa', currency: 'GMD' },
  { name: 'Ghana', officialName: 'Republic of Ghana', isoCode: 'GH', iso3Code: 'GHA', flag: '🇬🇭', continent: 'Africa', currency: 'GHS' },
  { name: 'Guinea', officialName: 'Republic of Guinea', isoCode: 'GN', iso3Code: 'GIN', flag: '🇬🇳', continent: 'Africa', currency: 'GNF' },
  { name: 'Guinea-Bissau', officialName: 'Republic of Guinea-Bissau', isoCode: 'GW', iso3Code: 'GNB', flag: '🇬🇼', continent: 'Africa', currency: 'XOF' },
  { name: 'Ivory Coast', officialName: "Republic of Côte d'Ivoire", isoCode: 'CI', iso3Code: 'CIV', flag: '🇨🇮', continent: 'Africa', currency: 'XOF' },
  { name: 'Kenya', officialName: 'Republic of Kenya', isoCode: 'KE', iso3Code: 'KEN', flag: '🇰🇪', continent: 'Africa', currency: 'KES' },
  { name: 'Lesotho', officialName: 'Kingdom of Lesotho', isoCode: 'LS', iso3Code: 'LSO', flag: '🇱🇸', continent: 'Africa', currency: 'LSL' },
  { name: 'Liberia', officialName: 'Republic of Liberia', isoCode: 'LR', iso3Code: 'LBR', flag: '🇱🇷', continent: 'Africa', currency: 'LRD' },
  { name: 'Libya', officialName: 'State of Libya', isoCode: 'LY', iso3Code: 'LBY', flag: '🇱🇾', continent: 'Africa', currency: 'LYD' },
  { name: 'Madagascar', officialName: 'Republic of Madagascar', isoCode: 'MG', iso3Code: 'MDG', flag: '🇲🇬', continent: 'Africa', currency: 'MGA' },
  { name: 'Malawi', officialName: 'Republic of Malawi', isoCode: 'MW', iso3Code: 'MWI', flag: '🇲🇼', continent: 'Africa', currency: 'MWK' },
  { name: 'Mali', officialName: 'Republic of Mali', isoCode: 'ML', iso3Code: 'MLI', flag: '🇲🇱', continent: 'Africa', currency: 'XOF' },
  { name: 'Mauritania', officialName: 'Islamic Republic of Mauritania', isoCode: 'MR', iso3Code: 'MRT', flag: '🇲🇷', continent: 'Africa', currency: 'MRU' },
  { name: 'Mauritius', officialName: 'Republic of Mauritius', isoCode: 'MU', iso3Code: 'MUS', flag: '🇲🇺', continent: 'Africa', currency: 'MUR' },
  { name: 'Morocco', officialName: 'Kingdom of Morocco', isoCode: 'MA', iso3Code: 'MAR', flag: '🇲🇦', continent: 'Africa', currency: 'MAD' },
  { name: 'Mozambique', officialName: 'Republic of Mozambique', isoCode: 'MZ', iso3Code: 'MOZ', flag: '🇲🇿', continent: 'Africa', currency: 'MZN' },
  { name: 'Namibia', officialName: 'Republic of Namibia', isoCode: 'NA', iso3Code: 'NAM', flag: '🇳🇦', continent: 'Africa', currency: 'NAD' },
  { name: 'Niger', officialName: 'Republic of the Niger', isoCode: 'NE', iso3Code: 'NER', flag: '🇳🇪', continent: 'Africa', currency: 'XOF' },
  { name: 'Nigeria', officialName: 'Federal Republic of Nigeria', isoCode: 'NG', iso3Code: 'NGA', flag: '🇳🇬', continent: 'Africa', currency: 'NGN', description: 'Africa\'s most populous country and biggest economy.' },
  { name: 'Rwanda', officialName: 'Republic of Rwanda', isoCode: 'RW', iso3Code: 'RWA', flag: '🇷🇼', continent: 'Africa', currency: 'RWF' },
  { name: 'São Tomé and Príncipe', officialName: 'Democratic Republic of São Tomé and Príncipe', isoCode: 'ST', iso3Code: 'STP', flag: '🇸🇹', continent: 'Africa', currency: 'STN' },
  { name: 'Senegal', officialName: 'Republic of Senegal', isoCode: 'SN', iso3Code: 'SEN', flag: '🇸🇳', continent: 'Africa', currency: 'XOF' },
  { name: 'Seychelles', officialName: 'Republic of Seychelles', isoCode: 'SC', iso3Code: 'SYC', flag: '🇸🇨', continent: 'Africa', currency: 'SCR' },
  { name: 'Sierra Leone', officialName: 'Republic of Sierra Leone', isoCode: 'SL', iso3Code: 'SLE', flag: '🇸🇱', continent: 'Africa', currency: 'SLL' },
  { name: 'Somalia', officialName: 'Federal Republic of Somalia', isoCode: 'SO', iso3Code: 'SOM', flag: '🇸🇴', continent: 'Africa', currency: 'SOS' },
  { name: 'South Africa', officialName: 'Republic of South Africa', isoCode: 'ZA', iso3Code: 'ZAF', flag: '🇿🇦', continent: 'Africa', currency: 'ZAR' },
  { name: 'South Sudan', officialName: 'Republic of South Sudan', isoCode: 'SS', iso3Code: 'SSD', flag: '🇸🇸', continent: 'Africa', currency: 'SSP' },
  { name: 'Sudan', officialName: 'Republic of the Sudan', isoCode: 'SD', iso3Code: 'SDN', flag: '🇸🇩', continent: 'Africa', currency: 'SDG' },
  { name: 'Tanzania', officialName: 'United Republic of Tanzania', isoCode: 'TZ', iso3Code: 'TZA', flag: '🇹🇿', continent: 'Africa', currency: 'TZS' },
  { name: 'Togo', officialName: 'Togolese Republic', isoCode: 'TG', iso3Code: 'TGO', flag: '🇹🇬', continent: 'Africa', currency: 'XOF' },
  { name: 'Tunisia', officialName: 'Republic of Tunisia', isoCode: 'TN', iso3Code: 'TUN', flag: '🇹🇳', continent: 'Africa', currency: 'TND' },
  { name: 'Uganda', officialName: 'Republic of Uganda', isoCode: 'UG', iso3Code: 'UGA', flag: '🇺🇬', continent: 'Africa', currency: 'UGX' },
  { name: 'Zambia', officialName: 'Republic of Zambia', isoCode: 'ZM', iso3Code: 'ZMB', flag: '🇿🇲', continent: 'Africa', currency: 'ZMW' },
  { name: 'Zimbabwe', officialName: 'Republic of Zimbabwe', isoCode: 'ZW', iso3Code: 'ZWE', flag: '🇿🇼', continent: 'Africa', currency: 'ZWL' },

  // ─── North America ──────────────────────────────────────────────────────────
  { name: 'Antigua and Barbuda', officialName: 'Antigua and Barbuda', isoCode: 'AG', iso3Code: 'ATG', flag: '🇦🇬', continent: 'North_America', currency: 'XCD' },
  { name: 'Bahamas', officialName: 'Commonwealth of the Bahamas', isoCode: 'BS', iso3Code: 'BHS', flag: '🇧🇸', continent: 'North_America', currency: 'BSD' },
  { name: 'Barbados', officialName: 'Barbados', isoCode: 'BB', iso3Code: 'BRB', flag: '🇧🇧', continent: 'North_America', currency: 'BBD' },
  { name: 'Belize', officialName: 'Belize', isoCode: 'BZ', iso3Code: 'BLZ', flag: '🇧🇿', continent: 'North_America', currency: 'BZD' },
  { name: 'Canada', officialName: 'Canada', isoCode: 'CA', iso3Code: 'CAN', flag: '🇨🇦', continent: 'North_America', currency: 'CAD', description: 'The world\'s second-largest country by area, known for diversity and nature.' },
  { name: 'Costa Rica', officialName: 'Republic of Costa Rica', isoCode: 'CR', iso3Code: 'CRI', flag: '🇨🇷', continent: 'North_America', currency: 'CRC' },
  { name: 'Cuba', officialName: 'Republic of Cuba', isoCode: 'CU', iso3Code: 'CUB', flag: '🇨🇺', continent: 'North_America', currency: 'CUP' },
  { name: 'Dominica', officialName: 'Commonwealth of Dominica', isoCode: 'DM', iso3Code: 'DMA', flag: '🇩🇲', continent: 'North_America', currency: 'XCD' },
  { name: 'Dominican Republic', officialName: 'Dominican Republic', isoCode: 'DO', iso3Code: 'DOM', flag: '🇩🇴', continent: 'North_America', currency: 'DOP' },
  { name: 'El Salvador', officialName: 'Republic of El Salvador', isoCode: 'SV', iso3Code: 'SLV', flag: '🇸🇻', continent: 'North_America', currency: 'USD' },
  { name: 'Grenada', officialName: 'Grenada', isoCode: 'GD', iso3Code: 'GRD', flag: '🇬🇩', continent: 'North_America', currency: 'XCD' },
  { name: 'Guatemala', officialName: 'Republic of Guatemala', isoCode: 'GT', iso3Code: 'GTM', flag: '🇬🇹', continent: 'North_America', currency: 'GTQ' },
  { name: 'Haiti', officialName: 'Republic of Haiti', isoCode: 'HT', iso3Code: 'HTI', flag: '🇭🇹', continent: 'North_America', currency: 'HTG' },
  { name: 'Honduras', officialName: 'Republic of Honduras', isoCode: 'HN', iso3Code: 'HND', flag: '🇭🇳', continent: 'North_America', currency: 'HNL' },
  { name: 'Jamaica', officialName: 'Jamaica', isoCode: 'JM', iso3Code: 'JAM', flag: '🇯🇲', continent: 'North_America', currency: 'JMD' },
  { name: 'Mexico', officialName: 'United Mexican States', isoCode: 'MX', iso3Code: 'MEX', flag: '🇲🇽', continent: 'North_America', currency: 'MXN', description: 'Land of ancient empires, vibrant culture, and incredible cuisine.' },
  { name: 'Nicaragua', officialName: 'Republic of Nicaragua', isoCode: 'NI', iso3Code: 'NIC', flag: '🇳🇮', continent: 'North_America', currency: 'NIO' },
  { name: 'Panama', officialName: 'Republic of Panama', isoCode: 'PA', iso3Code: 'PAN', flag: '🇵🇦', continent: 'North_America', currency: 'PAB' },
  { name: 'Saint Kitts and Nevis', officialName: 'Federation of Saint Christopher and Nevis', isoCode: 'KN', iso3Code: 'KNA', flag: '🇰🇳', continent: 'North_America', currency: 'XCD' },
  { name: 'Saint Lucia', officialName: 'Saint Lucia', isoCode: 'LC', iso3Code: 'LCA', flag: '🇱🇨', continent: 'North_America', currency: 'XCD' },
  { name: 'Saint Vincent and the Grenadines', officialName: 'Saint Vincent and the Grenadines', isoCode: 'VC', iso3Code: 'VCT', flag: '🇻🇨', continent: 'North_America', currency: 'XCD' },
  { name: 'Trinidad and Tobago', officialName: 'Republic of Trinidad and Tobago', isoCode: 'TT', iso3Code: 'TTO', flag: '🇹🇹', continent: 'North_America', currency: 'TTD' },
  { name: 'USA', officialName: 'United States of America', isoCode: 'US', iso3Code: 'USA', flag: '🇺🇸', continent: 'North_America', currency: 'USD', description: 'The world\'s superpower — home of Hollywood, Silicon Valley, and relentless ambition.' },

  // ─── South America ──────────────────────────────────────────────────────────
  { name: 'Argentina', officialName: 'Argentine Republic', isoCode: 'AR', iso3Code: 'ARG', flag: '🇦🇷', continent: 'South_America', currency: 'ARS', description: 'Home of Messi, tango, and the most passionate football fans on earth.' },
  { name: 'Bolivia', officialName: 'Plurinational State of Bolivia', isoCode: 'BO', iso3Code: 'BOL', flag: '🇧🇴', continent: 'South_America', currency: 'BOB' },
  { name: 'Brazil', officialName: 'Federative Republic of Brazil', isoCode: 'BR', iso3Code: 'BRA', flag: '🇧🇷', continent: 'South_America', currency: 'BRL', description: '5x World Cup champions and home of the greatest carnival on Earth.' },
  { name: 'Chile', officialName: 'Republic of Chile', isoCode: 'CL', iso3Code: 'CHL', flag: '🇨🇱', continent: 'South_America', currency: 'CLP' },
  { name: 'Colombia', officialName: 'Republic of Colombia', isoCode: 'CO', iso3Code: 'COL', flag: '🇨🇴', continent: 'South_America', currency: 'COP' },
  { name: 'Ecuador', officialName: 'Republic of Ecuador', isoCode: 'EC', iso3Code: 'ECU', flag: '🇪🇨', continent: 'South_America', currency: 'USD' },
  { name: 'Guyana', officialName: 'Co-operative Republic of Guyana', isoCode: 'GY', iso3Code: 'GUY', flag: '🇬🇾', continent: 'South_America', currency: 'GYD' },
  { name: 'Paraguay', officialName: 'Republic of Paraguay', isoCode: 'PY', iso3Code: 'PRY', flag: '🇵🇾', continent: 'South_America', currency: 'PYG' },
  { name: 'Peru', officialName: 'Republic of Peru', isoCode: 'PE', iso3Code: 'PER', flag: '🇵🇪', continent: 'South_America', currency: 'PEN' },
  { name: 'Suriname', officialName: 'Republic of Suriname', isoCode: 'SR', iso3Code: 'SUR', flag: '🇸🇷', continent: 'South_America', currency: 'SRD' },
  { name: 'Uruguay', officialName: 'Oriental Republic of Uruguay', isoCode: 'UY', iso3Code: 'URY', flag: '🇺🇾', continent: 'South_America', currency: 'UYU' },
  { name: 'Venezuela', officialName: 'Bolivarian Republic of Venezuela', isoCode: 'VE', iso3Code: 'VEN', flag: '🇻🇪', continent: 'South_America', currency: 'VES' },

  // ─── Oceania ─────────────────────────────────────────────────────────────────
  { name: 'Australia', officialName: 'Commonwealth of Australia', isoCode: 'AU', iso3Code: 'AUS', flag: '🇦🇺', continent: 'Oceania', currency: 'AUD', description: 'The land down under — vast, wild, and uniquely beautiful.' },
  { name: 'Fiji', officialName: 'Republic of Fiji', isoCode: 'FJ', iso3Code: 'FJI', flag: '🇫🇯', continent: 'Oceania', currency: 'FJD' },
  { name: 'Kiribati', officialName: 'Republic of Kiribati', isoCode: 'KI', iso3Code: 'KIR', flag: '🇰🇮', continent: 'Oceania', currency: 'AUD' },
  { name: 'Marshall Islands', officialName: 'Republic of the Marshall Islands', isoCode: 'MH', iso3Code: 'MHL', flag: '🇲🇭', continent: 'Oceania', currency: 'USD' },
  { name: 'Micronesia', officialName: 'Federated States of Micronesia', isoCode: 'FM', iso3Code: 'FSM', flag: '🇫🇲', continent: 'Oceania', currency: 'USD' },
  { name: 'Nauru', officialName: 'Republic of Nauru', isoCode: 'NR', iso3Code: 'NRU', flag: '🇳🇷', continent: 'Oceania', currency: 'AUD' },
  { name: 'New Zealand', officialName: 'New Zealand', isoCode: 'NZ', iso3Code: 'NZL', flag: '🇳🇿', continent: 'Oceania', currency: 'NZD' },
  { name: 'Palau', officialName: 'Republic of Palau', isoCode: 'PW', iso3Code: 'PLW', flag: '🇵🇼', continent: 'Oceania', currency: 'USD' },
  { name: 'Papua New Guinea', officialName: 'Independent State of Papua New Guinea', isoCode: 'PG', iso3Code: 'PNG', flag: '🇵🇬', continent: 'Oceania', currency: 'PGK' },
  { name: 'Samoa', officialName: 'Independent State of Samoa', isoCode: 'WS', iso3Code: 'WSM', flag: '🇼🇸', continent: 'Oceania', currency: 'WST' },
  { name: 'Solomon Islands', officialName: 'Solomon Islands', isoCode: 'SB', iso3Code: 'SLB', flag: '🇸🇧', continent: 'Oceania', currency: 'SBD' },
  { name: 'Tonga', officialName: 'Kingdom of Tonga', isoCode: 'TO', iso3Code: 'TON', flag: '🇹🇴', continent: 'Oceania', currency: 'TOP' },
  { name: 'Tuvalu', officialName: 'Tuvalu', isoCode: 'TV', iso3Code: 'TUV', flag: '🇹🇻', continent: 'Oceania', currency: 'AUD' },
  { name: 'Vanuatu', officialName: 'Republic of Vanuatu', isoCode: 'VU', iso3Code: 'VUT', flag: '🇻🇺', continent: 'Oceania', currency: 'VUV' },
];

// ─── Demo leaderboard data ─────────────────────────────────────────────────

const demoLeaderboard = [
  { isoCode: 'US', totalSupport: 47500, currentBid: 47500 },
  { isoCode: 'IN', totalSupport: 38200, currentBid: 38200 },
  { isoCode: 'JP', totalSupport: 29800, currentBid: 29800 },
  { isoCode: 'KR', totalSupport: 22100, currentBid: 22100 },
  { isoCode: 'DE', totalSupport: 18500, currentBid: 18500 },
  { isoCode: 'GB', totalSupport: 15200, currentBid: 15200 },
  { isoCode: 'BR', totalSupport: 12800, currentBid: 12800 },
  { isoCode: 'FR', totalSupport: 11100, currentBid: 11100 },
  { isoCode: 'CN', totalSupport: 9500, currentBid: 9500 },
  { isoCode: 'CA', totalSupport: 8200, currentBid: 8200 },
  { isoCode: 'AU', totalSupport: 7100, currentBid: 7100 },
  { isoCode: 'MX', totalSupport: 5800, currentBid: 5800 },
  { isoCode: 'AR', totalSupport: 4200, currentBid: 4200 },
  { isoCode: 'NG', totalSupport: 3500, currentBid: 3500 },
  { isoCode: 'IT', totalSupport: 2900, currentBid: 2900 },
  { isoCode: 'ES', totalSupport: 2300, currentBid: 2300 },
  { isoCode: 'PK', totalSupport: 1800, currentBid: 1800 },
  { isoCode: 'SA', totalSupport: 1500, currentBid: 1500 },
  { isoCode: 'TR', totalSupport: 1200, currentBid: 1200 },
  { isoCode: 'RU', totalSupport: 900, currentBid: 900 },
];

async function main() {
  console.log('🌍 Seeding WorldBid database...');

  // ─── Create admin user ────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash(
    process.env['ADMIN_PASSWORD'] ?? 'worldbid-admin-2024',
    12
  );

  await prisma.user.upsert({
    where: { email: 'admin@worldbid.app' },
    update: {},
    create: {
      email: 'admin@worldbid.app',
      username: 'worldbid_admin',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      avatar: null,
    },
  });

  console.log('✅ Admin user created');

  // ─── Create demo users ────────────────────────────────────────────────────
  const demoUsers = [
    { email: 'alice@demo.com', username: 'alice_watcher', countryCode: 'IN' },
    { email: 'bob@demo.com', username: 'bob_supporter', countryCode: 'US' },
    { email: 'charlie@demo.com', username: 'charlie_fan', countryCode: 'JP' },
    { email: 'diana@demo.com', username: 'diana_global', countryCode: 'BR' },
    { email: 'evan@demo.com', username: 'evan_champion', countryCode: 'DE' },
  ];

  const demoUserRecords = [];
  for (const u of demoUsers) {
    const hash = await bcrypt.hash('demo1234', 12);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: hash },
    });
    demoUserRecords.push(user);
  }

  console.log('✅ Demo users created');

  // ─── Seed countries ───────────────────────────────────────────────────────
  console.log(`🌍 Seeding ${countries.length} countries...`);

  for (const country of countries) {
    const demo = demoLeaderboard.find((d) => d.isoCode === country.isoCode);
    await prisma.country.upsert({
      where: { isoCode: country.isoCode },
      update: {},
      create: {
        ...country,
        totalSupport: demo?.totalSupport ?? 0,
        currentBid: demo?.currentBid ?? 0,
        rank: 0, // Will be recalculated below
        supporterCount: demo ? Math.floor(demo.totalSupport / 50) : 0,
      },
    });
  }

  // ─── Recalculate ranks ────────────────────────────────────────────────────
  const allCountries = await prisma.country.findMany({
    orderBy: { totalSupport: 'desc' },
  });

  let rank = 1;
  for (const c of allCountries) {
    await prisma.country.update({
      where: { id: c.id },
      data: { rank, previousRank: rank },
    });
    rank++;
  }

  console.log('✅ Countries seeded and ranked');

  // ─── Seed demo bids and activities ────────────────────────────────────────
  const topCountries = await prisma.country.findMany({
    where: { isoCode: { in: demoLeaderboard.map((d) => d.isoCode) } },
    orderBy: { rank: 'asc' },
    take: 10,
  });

  for (let i = 0; i < Math.min(topCountries.length, demoUserRecords.length); i++) {
    const country = topCountries[i];
    const user = demoUserRecords[i % demoUserRecords.length];

    if (!country || !user) continue;

    const bid = await prisma.bid.upsert({
      where: { idempotencyKey: `demo_seed_bid_${i}` },
      update: {},
      create: {
        userId: user.id,
        countryId: country.id,
        amount: country.currentBid,
        currency: 'USD',
        status: 'CONFIRMED',
        transactionId: `demo_tx_${i}`,
        idempotencyKey: `demo_seed_bid_${i}`,
      },
    });

    await prisma.payment.upsert({
      where: { bidId: bid.id },
      update: {},
      create: {
        userId: user.id,
        bidId: bid.id,
        provider: 'mock',
        providerPaymentId: `demo_pay_${i}`,
        amount: country.currentBid,
        currency: 'USD',
        status: 'COMPLETED',
      },
    });

    await prisma.countrySupport.upsert({
      where: { userId_countryId: { userId: user.id, countryId: country.id } },
      update: { totalAmount: { increment: country.currentBid }, bidsCount: { increment: 1 } },
      create: {
        userId: user.id,
        countryId: country.id,
        totalAmount: country.currentBid,
        bidsCount: 1,
      },
    });

    await prisma.activity.create({
      data: {
        type: 'BID_PLACED',
        countryId: country.id,
        userId: user.id,
        amount: country.currentBid,
        previousRank: country.rank,
        newRank: country.rank,
      },
    });
  }

  console.log('✅ Demo bids and activities seeded');

  // ─── Seed leaderboard snapshots ───────────────────────────────────────────
  const snapshotCountries = await prisma.country.findMany({
    where: { totalSupport: { gt: 0 } },
    orderBy: { rank: 'asc' },
  });

  const now = new Date();
  for (const country of snapshotCountries) {
    // Create snapshots for the past 7 days
    for (let day = 7; day >= 0; day--) {
      const snapshotAt = new Date(now);
      snapshotAt.setDate(snapshotAt.getDate() - day);

      await prisma.leaderboardSnapshot.create({
        data: {
          countryId: country.id,
          rank: country.rank + Math.floor(Math.random() * 3),
          totalSupport: country.totalSupport * (1 - day * 0.1),
          currentBid: country.currentBid * (1 - day * 0.1),
          snapshotAt,
        },
      });
    }
  }

  console.log('✅ Leaderboard snapshots seeded');

  console.log('🎉 WorldBid database seeded successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   Countries: ${countries.length}`);
  console.log(`   Users: ${demoUserRecords.length + 1} (including admin)`);
  console.log(`   Demo bids: ${Math.min(topCountries.length, demoUserRecords.length)}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
