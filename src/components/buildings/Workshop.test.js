import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Workshop from './Workshop.vue';
import { store } from '../../store';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}));

describe('Workshop Component', () => {
  beforeEach(() => {
    store.xp = 0;
  });

  it('should display the correct target phoneme', () => {
    const wrapper = mount(Workshop);
    expect(wrapper.text()).toContain("Drag the letter 'm' to the slot");
  });

  it('should handle incorrect drops with shake animation', async () => {
    const wrapper = mount(Workshop);
    
    // Simulate drop event with incorrect data
    const slot = wrapper.find('.rune-slot');
    const dropEvent = {
      dataTransfer: {
        getData: () => 's'
      }
    };
    
    await slot.trigger('drop', dropEvent);
    
    expect(wrapper.find('.shake-error').exists()).toBe(true);
    expect(store.xp).toBe(0);
  });

  it('should handle correct drops with success message and XP increase', async () => {
    const wrapper = mount(Workshop);
    
    const slot = wrapper.find('.rune-slot');
    const dropEvent = {
      dataTransfer: {
        getData: () => 'm'
      }
    };
    
    await slot.trigger('drop', dropEvent);
    
    expect(wrapper.find('.success').exists()).toBe(true);
    expect(wrapper.text()).toContain("Well done!");
    expect(store.xp).toBe(25);
  });
});
