import { fileURLToPath } from "node:url";

export default {
  oxc: { tsconfig: fileURLToPath(new URL("../packages/domain/tsconfig.json", import.meta.url)) },
  test: {
    environment: "node",
    include: ["src/pantry/**/*.test.ts", "src/recommendations/**/*.test.ts"],
  },
};
