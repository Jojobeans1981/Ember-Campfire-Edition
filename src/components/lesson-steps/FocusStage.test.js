import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FocusStage from './FocusStage.vue';

describe('FocusStage', () => {
  it('renders one element per token with text content', () => {
    const wrapper = mount(FocusStage, {
      props: {
        tokens: [
          { text: 'a', kind: 'grapheme', state: 'idle' },
          { text: 't', kind: 'grapheme', state: 'idle' },
        ],
      },
    });
    const tokens = wrapper.findAll('.focus-token');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text()).toBe('a');
    expect(tokens[1].text()).toBe('t');
  });

  it('applies state-active to the active token', () => {
    const wrapper = mount(FocusStage, {
      props: {
        tokens: [
          { text: 'a', kind: 'phoneme', state: 'idle' },
          { text: 't', kind: 'phoneme', state: 'active' },
        ],
      },
    });
    const tokens = wrapper.findAll('.focus-token');
    expect(tokens[0].classes()).toContain('state-idle');
    expect(tokens[1].classes()).toContain('state-active');
  });

  it('applies state-done when a token is completed', () => {
    const wrapper = mount(FocusStage, {
      props: {
        tokens: [{ text: 'a', kind: 'grapheme', state: 'done' }],
        emphasis: 'letter',
      },
    });
    expect(wrapper.find('.focus-token').classes()).toContain('state-done');
  });

  it('applies emphasis class from prop', () => {
    const wrapper = mount(FocusStage, {
      props: {
        tokens: [{ text: 'The cat sat.', kind: 'sentence' }],
        emphasis: 'sentence',
      },
    });
    expect(wrapper.find('.focus-stage').classes()).toContain('emphasis-sentence');
  });

  it('applies kind class from token', () => {
    const wrapper = mount(FocusStage, {
      props: {
        tokens: [
          { text: 'th', kind: 'grapheme-irregular' },
          { text: 'e', kind: 'grapheme' },
        ],
      },
    });
    const tokens = wrapper.findAll('.focus-token');
    expect(tokens[0].classes()).toContain('kind-grapheme-irregular');
    expect(tokens[1].classes()).toContain('kind-grapheme');
  });

  it('defaults kind to grapheme and state to idle when not provided', () => {
    const wrapper = mount(FocusStage, {
      props: { tokens: [{ text: 'a' }] },
    });
    const classes = wrapper.find('.focus-token').classes();
    expect(classes).toContain('kind-grapheme');
    expect(classes).toContain('state-idle');
  });

  it('hides tokens from assistive tech since audio carries instruction', () => {
    const wrapper = mount(FocusStage, {
      props: { tokens: [{ text: 'a' }] },
    });
    expect(wrapper.find('.focus-token').attributes('aria-hidden')).toBe('true');
  });

  it('renders nothing when tokens is empty', () => {
    const wrapper = mount(FocusStage, { props: { tokens: [] } });
    expect(wrapper.findAll('.focus-token')).toHaveLength(0);
    expect(wrapper.find('.focus-stage').exists()).toBe(true);
  });
});
