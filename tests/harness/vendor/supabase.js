// Minimal mock of the Supabase JS v2 client for headless testing only.
// Every chained call resolves to an empty-but-valid result so boot-sequence
// code that awaits these calls doesn't hang or throw due to network absence.
(function () {
  function makeChain() {
    const handler = {
      get(target, prop) {
        if (prop === 'then') {
          return (resolve) => resolve({ data: [], error: null, count: 0 });
        }
        if (prop === 'catch' || prop === 'finally') {
          return () => makeChain();
        }
        if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'toJSON') {
          return () => '[mock-chain]';
        }
        return (...args) => makeChain();
      },
      apply() {
        return makeChain();
      }
    };
    return new Proxy(function () {}, handler);
  }

  function createClient(url, key) {
    return {
      from: (...args) => makeChain(),
      rpc: (...args) => makeChain(),
      auth: {
        signInWithPassword: async () => ({ data: null, error: { message: 'mock: no network in sandbox' } }),
        signUp: async () => ({ data: null, error: { message: 'mock: no network in sandbox' } }),
        signOut: async () => ({ error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      storage: {
        from: (bucket) => ({
          upload: async () => ({ data: null, error: { message: 'mock: no network in sandbox' } }),
          getPublicUrl: (path) => ({ data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
          createSignedUrl: async (path, expiresIn) => ({ data: { signedUrl: `https://mock.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=mock&exp=${expiresIn}` }, error: null }),
          list: async () => ({ data: [], error: null }),
          remove: async () => ({ data: null, error: null }),
        }),
      },
      functions: {
        invoke: async () => ({ data: null, error: { message: 'mock: no network in sandbox' } }),
      },
      channel: (...args) => ({
        on: () => ({ subscribe: () => ({}) }),
        subscribe: () => ({}),
      }),
      removeChannel: () => {},
    };
  }

  window.supabase = { createClient };
})();
