// ====================================================================
// 生产构建脚本：用 terser 压缩混淆所有源码
// 输出到 dist/ 目录，变量名混淆、删除注释、死代码消除
// ====================================================================

const fs = require('fs');
const path = require('path');

let terser;
try {
    terser = require('terser');
} catch (e) {
    console.error('Error: terser not installed. Run: npm install --save-dev terser');
    process.exit(1);
}

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');

// 递归获取所有 .js 文件
function getJsFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getJsFiles(fullPath));
        } else if (entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

async function build() {
    console.log('=== Production Build (terser minify) ===\n');

    // 清理 dist 目录
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });

    const files = getJsFiles(SRC_DIR);
    console.log('Found ' + files.length + ' source files\n');

    let totalOriginal = 0;
    let totalMinified = 0;

    for (const file of files) {
        const relativePath = path.relative(SRC_DIR, file);
        const outputPath = path.join(DIST_DIR, relativePath);

        // 确保输出目录存在
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        const code = fs.readFileSync(file, 'utf8');
        const result = await terser.minify(code, {
            compress: {
                drop_console: false,
                dead_code: true,
                unused: true,
                drop_debugger: true,
                conditionals: true,
                evaluate: true,
                booleans: true,
            },
            mangle: {
                toplevel: true,
                properties: false,
            },
            format: {
                comments: false,
                beautify: false,
            },
            sourceMap: false,
        });

        if (result.error) {
            console.error('Error minifying ' + relativePath + ':', result.error);
            process.exit(1);
        }

        fs.writeFileSync(outputPath, result.code);

        const originalSize = Buffer.byteLength(code);
        const minifiedSize = Buffer.byteLength(result.code);
        const reduction = Math.round((1 - minifiedSize / originalSize) * 100);

        totalOriginal += originalSize;
        totalMinified += minifiedSize;

        console.log('  ✓ ' + relativePath.padEnd(25) + ' ' + String(originalSize).padStart(6) + 'B → ' + String(minifiedSize).padStart(6) + 'B  (' + reduction + '% smaller)');
    }

    // 复制 config/ 目录到 dist/（配置文件不需要压缩，直接复制）
    const CONFIG_SRC = path.join(__dirname, 'config');
    const CONFIG_DIST = path.join(DIST_DIR, 'config');
    if (fs.existsSync(CONFIG_SRC)) {
        if (fs.existsSync(CONFIG_DIST)) {
            fs.rmSync(CONFIG_DIST, { recursive: true });
        }
        fs.mkdirSync(CONFIG_DIST, { recursive: true });
        let configCount = 0;
        for (const file of fs.readdirSync(CONFIG_SRC)) {
            if (file.endsWith('.js')) {
                fs.copyFileSync(path.join(CONFIG_SRC, file), path.join(CONFIG_DIST, file));
                configCount++;
            }
        }
        console.log('  ✓ config/ directory copied (' + configCount + ' files)');
    }

    const totalReduction = Math.round((1 - totalMinified / totalOriginal) * 100);
    console.log('\n=== Build Complete ===');
    console.log('  Total: ' + totalOriginal + 'B → ' + totalMinified + 'B (' + totalReduction + '% reduction)');
    console.log('  Output: ' + DIST_DIR);
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
