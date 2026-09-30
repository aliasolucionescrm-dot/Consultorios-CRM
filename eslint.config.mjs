import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['**/dist/**','**/.next/**','**/next-env.d.ts']}, js.configs.recommended, ...ts.configs.recommended, {files:['**/*.{ts,tsx,mjs}'], languageOptions:{globals:{process:'readonly',console:'readonly',URL:'readonly',Buffer:'readonly',setTimeout:'readonly',clearTimeout:'readonly',setInterval:'readonly',fetch:'readonly'}},rules:{'@typescript-eslint/no-explicit-any':'error','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}});
