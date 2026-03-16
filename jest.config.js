module.exports = {
  preset: "jest-expo",

  testEnvironment: "node",

  resetMocks: true,

  setupFilesAfterEnv: [
    "@testing-library/jest-native/extend-expect"
  ],

  transformIgnorePatterns: [
    "node_modules/(?!(react-native|expo|@expo|expo-modules-core|expo-router|@react-native|@react-navigation)/)"
  ],

  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  testPathIgnorePatterns: [
    "/node_modules/",
    "/ios/",
    "/android/"
  ]
};