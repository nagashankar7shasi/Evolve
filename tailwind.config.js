// Content globs for Tailwind's static class scanner. This project has no custom theme/plugin
// config -- the live site previously used the unconfigured Play CDN (cdn.tailwindcss.com), so a
// default-theme CLI build is a faithful drop-in replacement. Scans every file that can contain a
// Tailwind utility class string: the single index.html and every classic-script JS file (each one
// builds chunks of UI markup as HTML template-literal strings -- see js/*.js throughout the app).
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {},
  },
  plugins: [],
};
