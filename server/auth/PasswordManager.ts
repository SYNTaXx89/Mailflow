/**
 * Password Manager - Secure password hashing and validation
 * 
 * Handles password hashing, validation, and secure comparison
 * using bcrypt for the self-hosted MailFlow instance.
 */

import bcrypt from 'bcrypt';

export class PasswordManager {
  private static readonly SALT_ROUNDS = 12; // High security for self-hosted

  /**
   * Hash a password using bcrypt
   */
  static async hash(password: string): Promise<string> {
    try {
      const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);
      return hashedPassword;
    } catch (error) {
      console.error('❌ Failed to hash password:', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Compare a password with its hash
   */
  static async compare(password: string, hash: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hash);
      return isValid;
    } catch (error) {
      console.error('❌ Failed to compare password:', error);
      throw new Error('Password comparison failed');
    }
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Minimum length
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Maximum length (prevent DoS)
    if (password.length > 128) {
      errors.push('Password must be less than 128 characters long');
    }

    // At least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // At least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // At least one number
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // At least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*(),.?":{}|<>';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check if a password hash needs rehashing (security upgrade)
   */
  static needsRehash(hash: string): boolean {
    try {
      // Check if the hash was created with fewer rounds than current standard
      const rounds = bcrypt.getRounds(hash);
      return rounds < this.SALT_ROUNDS;
    } catch (error) {
      // If we can't get rounds, assume it needs rehashing
      return true;
    }
  }

  /**
   * Rehash password if needed (for security upgrades)
   */
  static async rehashIfNeeded(password: string, currentHash: string): Promise<string | null> {
    if (this.needsRehash(currentHash)) {
      const isValid = await this.compare(password, currentHash);
      if (isValid) {
        return await this.hash(password);
      }
    }
    return null;
  }
}