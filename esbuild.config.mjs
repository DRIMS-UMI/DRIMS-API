import "dotenv/config";
import esbuild from "esbuild";

const isProduction = process.env.NODE_ENV === "production";

async function build() {
  try {
    const config = {
        entryPoints: ["src/index.mjs"],
        alias: {
            "@": "./src",
        },
        platform: "node",
        bundle: true,
        outdir: "dist",
        sourcemap: true,
        minify: isProduction,
        outExtension: {'.js': '.cjs'},
        target: 'node18',
        format: 'cjs',
        logLevel: "info",
    }

    if (isProduction) {
        await esbuild.build(config);
         console.log('✨ Build succeeded & disposed the context.');
        
    }else {
        const context = await esbuild.context(config);
        await context.watch();
        console.log('✨ Build succeeded & watching the files.');
    }
  } catch (error) {
    console.error("Build: failed", error);
    process.exit(1);
  }
}

build();
