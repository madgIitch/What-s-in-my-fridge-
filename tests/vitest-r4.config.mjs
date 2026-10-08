import { fileURLToPath } from 'node:url';
export default { oxc: { tsconfig: fileURLToPath(new URL('../packages/domain/tsconfig.json', import.meta.url)) }, test: { environment: 'node', include: ['src/pantry/**/*.test.ts', 'src/normalization/**/*.test.ts', 'src/recommendations/**/*.test.ts', 'src/recipes/availability.test.ts', 'src/cooking/**/*.test.ts'] } };
