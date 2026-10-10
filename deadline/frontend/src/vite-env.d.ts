/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_METRIKA_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
