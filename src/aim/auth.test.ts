import { describe, it, expect } from 'vitest';
import {
  getAIMAuthState,
  saveAIMAuthState,
  isTokenExpired,
  logoutFromAIM,
} from './auth';
import type { AIMAuthState } from './auth';

describe('AIM Auth', () => {
  describe('getAIMAuthState', () => {
    it('returns defaults when no state stored', async () => {
      const state = await getAIMAuthState();
      expect(state).toEqual({
        isLoggedIn: false,
        accessToken: null,
        userEmail: null,
        expiresAt: null,
      });
    });
  });

  describe('saveAIMAuthState and getAIMAuthState roundtrip', () => {
    it('persists and retrieves auth state', async () => {
      const saved: AIMAuthState = {
        isLoggedIn: true,
        accessToken: 'test-token-123',
        userEmail: 'user@example.com',
        expiresAt: '2099-01-01T00:00:00.000Z',
      };

      await saveAIMAuthState(saved);
      const loaded = await getAIMAuthState();

      expect(loaded).toEqual(saved);
    });
  });

  describe('isTokenExpired', () => {
    it('returns false for future expiry', () => {
      const state: AIMAuthState = {
        isLoggedIn: true,
        accessToken: 'tok',
        userEmail: null,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      expect(isTokenExpired(state)).toBe(false);
    });

    it('returns true for past expiry', () => {
      const state: AIMAuthState = {
        isLoggedIn: true,
        accessToken: 'tok',
        userEmail: null,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      expect(isTokenExpired(state)).toBe(true);
    });

    it('returns false when expiresAt is null', () => {
      const state: AIMAuthState = {
        isLoggedIn: true,
        accessToken: 'tok',
        userEmail: null,
        expiresAt: null,
      };
      expect(isTokenExpired(state)).toBe(false);
    });
  });

  describe('logoutFromAIM', () => {
    it('clears auth state', async () => {
      // First, save a logged-in state
      await saveAIMAuthState({
        isLoggedIn: true,
        accessToken: 'tok',
        userEmail: 'user@example.com',
        expiresAt: '2099-01-01T00:00:00.000Z',
      });

      // Verify it was saved
      let state = await getAIMAuthState();
      expect(state.isLoggedIn).toBe(true);

      // Logout
      await logoutFromAIM();

      // Verify it was cleared
      state = await getAIMAuthState();
      expect(state).toEqual({
        isLoggedIn: false,
        accessToken: null,
        userEmail: null,
        expiresAt: null,
      });
    });
  });
});
