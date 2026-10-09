import * as ts from 'typescript';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

// Vite/esbuild no emite emitDecoratorMetadata, que Nest necesita para DI por constructor.
function typescriptDecoratorMetadata(): Plugin {
  return {
    name: 'typescript-decorator-metadata',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.replaceAll('\\', '/');
      if (!normalizedId.endsWith('.ts') || normalizedId.includes('/node_modules/')) {
        return null;
      }

      const result = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          useDefineForClassFields: true,
          verbatimModuleSyntax: true,
          sourceMap: true,
        },
      });

      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
      };
    },
  };
}

export default defineConfig({
  esbuild: false,
  plugins: [typescriptDecoratorMetadata()],
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
