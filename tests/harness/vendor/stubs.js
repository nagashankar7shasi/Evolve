// Minimal stubs for PapaParse and pdf-lib so the boot sequence doesn't throw
// ReferenceErrors when these libs are unreachable in the sandbox. Not used
// for correctness testing of CSV/PDF features themselves.
window.Papa = {
  parse: function (input, opts) {
    if (opts && typeof opts.complete === 'function') {
      opts.complete({ data: [], errors: [], meta: {} });
    }
    return { data: [], errors: [], meta: {} };
  },
};

window.PDFLib = {
  PDFDocument: {
    load: async () => ({
      getPages: () => [],
      embedFont: async () => ({}),
      save: async () => new Uint8Array(),
    }),
    create: async () => ({
      addPage: () => ({ drawText() {}, getSize: () => ({ width: 0, height: 0 }) }),
      embedFont: async () => ({}),
      save: async () => new Uint8Array(),
    }),
  },
  StandardFonts: { Helvetica: 'Helvetica' },
  rgb: () => ({}),
  degrees: () => 0,
};
