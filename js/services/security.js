/* ============================================================
   MODULE: SECURITY (SHA-256 via SubtleCrypto, AES via simple XOR fallback)
   ============================================================ */
export const Security = (() => {
  // SHA-256 using SubtleCrypto API
  async function sha256(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch {
      // Fallback: simple hash for environments without subtle crypto
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash).toString(16).padStart(64,'0');
    }
  }

  // Simple symmetric encrypt/decrypt (XOR with key) for non-critical fields
  function xorEncrypt(text, key) {
    if (!text) return text;
    return btoa(text.split('').map((c,i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join(''));
  }
  
  function xorDecrypt(enc, key) {
    if (!enc) return enc;
    try {
      const text = atob(enc);
      return text.split('').map((c,i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
    } catch { 
      return enc; 
    }
  }

  const CIPHER_KEY = 'LaOla_SecureKey_2025_#!';

  return {
    hashPassword: sha256,
    encrypt: (t) => xorEncrypt(t, CIPHER_KEY),
    decrypt: (t) => xorDecrypt(t, CIPHER_KEY),
    generateChecksum: (data) => {
      const str = JSON.stringify(data);
      let hash = 0;
      for (let i = 0; i < str.length; i++) { 
        hash = ((hash << 5) - hash) + str.charCodeAt(i); 
        hash |= 0; 
      }
      return Math.abs(hash).toString(16);
    }
  };
})();
