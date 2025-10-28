module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*",
    "/generated/**/*", 
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {  
    "quotes": ["error", "double"],  
    "import/no-unresolved": 0,  
    "indent": ["error", 2],  
    "linebreak-style": 0,  
    "require-jsdoc": 0,  
    "valid-jsdoc": 0,  
    "no-trailing-spaces": 0,  
    "object-curly-spacing": 0,  
    "comma-dangle": 0,    
    "max-len": 0,                       
    "@typescript-eslint/no-explicit-any": 0,
  },
};
