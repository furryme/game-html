module.exports = {
  testDir: ".",
  testMatch: ["**/*.spec.js", "!**/combat-screenshot.spec.js"],
  use: {
    headless: true,
    screenshot: "off",
    video: "off",
  },
};
