import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge } from '../lib/authCreds';

// PKCE code verifier and challenge

describe('PKCE Code Verifier and Challenge', () => {
  it('should generate a code verifier of correct length', () => {
    const verifier = generateCodeVerifier(128);
    expect(verifier).toHaveLength(128);
  });

  it('should generate a valid code challenge from verifier', async () => {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });
});
