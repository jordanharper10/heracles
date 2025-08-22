declare module 'sql.js' {
  // minimal typing so TS is happy; you can expand later if you want
  const init: (opts?: { locateFile?: (f: string) => string }) => Promise<any>;
  export default init;
}

