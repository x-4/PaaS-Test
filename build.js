// ====================================================================
// 生产构建脚本：纯复制源码到 dist/（零依赖，无需安装任何包）
// 输出到 dist/ 目录，保持源码原样，确保部署稳定性
// ====================================================================

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');

// 递归复制目录
function copyDir(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const dstPath = path.join(dst, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, dstPath);
        } else {
            fs.copyFileSync(srcPath, dstPath);
        }
    }
}

// 递归获取所有文件（用于统计）
function getAllFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getAllFiles(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

function build() {
    console.log('=== Production Build (copy mode, zero dependencies) ===\n');

    // 清理 dist 目录
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });

    // 1. 复制整个 src/ 目录（包含所有子目录和文件）
    copyDir(SRC_DIR, DIST_DIR);
    const srcFiles = getAllFiles(SRC_DIR);
    console.log('  ✓ src/ directory copied (' + srcFiles.length + ' files)');

    // 2. 复制 config/ 目录到 dist/
    const CONFIG_SRC = path.join(__dirname, 'config');
    const CONFIG_DIST = path.join(DIST_DIR, 'config');
    if (fs.existsSync(CONFIG_SRC)) {
        copyDir(CONFIG_SRC, CONFIG_DIST);
        const configFiles = getAllFiles(CONFIG_SRC);
        console.log('  ✓ config/ directory copied (' + configFiles.length + ' files)');
    }

    // 3. 修复 dist/config.js 中的引用路径：../config → ./config/index
    const distConfigPath = path.join(DIST_DIR, 'config.js');
    if (fs.existsSync(distConfigPath)) {
        let configCode = fs.readFileSync(distConfigPath, 'utf8');
        configCode = configCode.replace(/require\(["']\.\.\/config["']\)/g, 'require("./config/index")');
        fs.writeFileSync(distConfigPath, configCode);
        console.log('  ✓ dist/config.js path rewritten');
    }

    // 统计总大小
    const distFiles = getAllFiles(DIST_DIR);
    let totalSize = 0;
    for (const file of distFiles) {
        totalSize += fs.statSync(file).size;
    }

    console.log('\n=== Build Complete ===');
    console.log('  Total: ' + distFiles.length + ' files, ' + (totalSize / 1024).toFixed(1) + ' KB');
    console.log('  Output: ' + DIST_DIR);
}

try {
    build();
} catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
}
