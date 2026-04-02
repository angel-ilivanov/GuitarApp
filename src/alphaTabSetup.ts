import { Environment } from '@coderline/alphatab'

Environment.initializeMain(
  // Worker factory — creates the synthesis/player web worker
  () => new Worker('/alphaTab.worker.mjs', { type: 'module' }),
  // Audio worklet factory — registers the audio worklet processor
  (context) => context.audioWorklet.addModule('/alphaTab.worklet.mjs')
)
