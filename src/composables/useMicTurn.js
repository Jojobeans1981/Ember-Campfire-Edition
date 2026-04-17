function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const MIC_TURN_SETTLE_MS = 180;

export function useMicTurn({ ember, cancelListening }) {
  async function prepareMicTurn() {
    ember?.stopSpeaking?.();
    cancelListening?.();
    await wait(MIC_TURN_SETTLE_MS);
  }

  return {
    prepareMicTurn,
  };
}
