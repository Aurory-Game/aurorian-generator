/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  setupFiles: ["dotenv/config"],
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
  testTimeout: 10000
};