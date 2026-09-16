export function createDemoSession() {
  return {
    expert: 'idle',
    motion: 'idle',
    transcript: 'raw',
    image: 'source',
    video: 'reference',
    music: 'silent',
  };
}

const transitions = {
  EXPERT_START: ['expert', 'running'],
  EXPERT_DONE: ['expert', 'done'],
  MOTION_GENERATE: ['motion', 'done'],
  TRANSCRIPT_START: ['transcript', 'cleaning'],
  TRANSCRIPT_DONE: ['transcript', 'clean'],
  IMAGE_START: ['image', 'loading'],
  IMAGE_DONE: ['image', 'generated'],
  VIDEO_START: ['video', 'loading'],
  VIDEO_DONE: ['video', 'generated'],
  MUSIC_START: ['music', 'loading'],
  MUSIC_DONE: ['music', 'generated'],
};

export function transitionDemo(session, action = {}) {
  const transition = transitions[action.type];
  if (!transition) return session;
  const [key, value] = transition;
  return { ...session, [key]: value };
}
