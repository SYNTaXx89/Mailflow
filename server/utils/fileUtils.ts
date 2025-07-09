import fs from 'fs';
import path from 'path';

// Data storage paths
export const DATA_DIR = path.join(__dirname, '../../data');
export const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
export const EMAILS_FILE = path.join(DATA_DIR, 'emails.json');
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const readJsonFile = (filePath: string, defaultValue: any = {}) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
};

export const writeJsonFile = (filePath: string, data: any) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
};