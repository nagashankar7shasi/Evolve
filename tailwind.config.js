// Content globs for Tailwind's static class scanner. This project has no custom theme/plugin
// config -- the live site previously used the unconfigured Play CDN (cdn.tailwindcss.com), so a
// default-theme CLI build is a faithful drop-in replacement. Scans every file that can contain a
// Tailwind utility class string: index.html, admin-console.html (the admin-only markup that used
// to be part of index.html's <main id="view-admin"> before it was split into its own
// fetched-on-demand file -- see js/03b_dev_console.js's ensureAdminConsoleLoaded -- still needs
// scanning or any class used only inside it silently stops being compiled), and every
// classic-script JS file (each one builds chunks of UI markup as HTML template-literal strings --
// see js/*.js throughout the app).
module.exports = {
  content: ['./index.html', './admin-console.html', './js/**/*.js'],
  theme: {
    extend: {},
  },
  plugins: [],
};
