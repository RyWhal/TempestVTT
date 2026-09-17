// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { useDiceSettingsStore } from './diceSettingsStore';

it('remembers the local visual dice preference across rehydration', async () => {
  useDiceSettingsStore.getState().setShowDiceAnimations(false);
  expect(JSON.parse(localStorage.getItem('tempest-dice-settings')!).state.showDiceAnimations).toBe(false);
  useDiceSettingsStore.setState({ showDiceAnimations: true });
  localStorage.setItem('tempest-dice-settings', JSON.stringify({ state: { showDiceAnimations: false }, version: 0 }));
  await useDiceSettingsStore.persist.rehydrate();
  expect(useDiceSettingsStore.getState().showDiceAnimations).toBe(false);
  useDiceSettingsStore.getState().setShowDiceAnimations(true);
});
