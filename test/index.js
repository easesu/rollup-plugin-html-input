const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
const { rollup } = require('rollup');
const htmlPlugin = require('../index');
const distDir = path.resolve(__dirname, 'dist');

function makeRollupBuild(entries) {
    return rollup({
        input: entries,
        plugins: [
            htmlPlugin()
        ]
    });
}

function createScript(scripts) {
    return (scripts || []).map(script => {
        if (script) {
            if (script.content) {
                return `<script>${script.content}</script>`
            } else if (script.src) {
                return `<script src="${script.src}"></script>`;
            }
            return '';
        }
    }).join('');
}

const firstHtmlPart = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Index</title>
</head>
<body>`;

const secondHtmlPart = `</body>
</html>`;
function createHtml(scripts) {
    return firstHtmlPart + createScript(scripts) + secondHtmlPart;
}

describe('html entry', () => {
    const inlineScriptContent = 'console.log("from inline script");';
    const externalScriptContent = 'console.log("from external script");';
    const externalScriptName = './external-script.js';
    const externalScriptPath = path.resolve(__dirname, externalScriptName);
    const inlineScriptHtmlPath = path.resolve(__dirname, './inline-script.html');
    const externalScriptHtmlPath = path.resolve(__dirname, './external-script.html');
    const mixedScriptHtmlPath = path.resolve(__dirname, './mixed-script.html');
    const htmlPages = {
        [inlineScriptHtmlPath]: [{ content: inlineScriptContent }],
        [externalScriptHtmlPath]: [{ src: externalScriptName }],
        [mixedScriptHtmlPath]: [{ content: inlineScriptContent }, { src: externalScriptName }]
    }

    before(() => {
        fs.writeFileSync(externalScriptPath, externalScriptContent);
        Object.keys(htmlPages).forEach(filePath => {
            fs.writeFileSync(filePath, createHtml(htmlPages[filePath]));
        });
    });

    after(() => {
        fs.unlinkSync(externalScriptPath);
        Object.keys(htmlPages).forEach(filePath => {
            fs.unlinkSync(filePath);
        });
        fs.removeSync(distDir);
    });

    it('bundle inline script', (done) => {
        makeRollupBuild(inlineScriptHtmlPath)
            .then(builder => builder.write({
                output: {
                    format: 'iife',
                    dir: distDir
                }
            }))
            .then(result => {
                const outputCode = result.output[0].code;
                assert.ok(outputCode.indexOf(firstHtmlPart) === 0);
                assert.ok(outputCode.indexOf(secondHtmlPart) !== -1);
                assert.ok(outputCode.indexOf(inlineScriptContent) !== -1);
                assert.ok(outputCode.indexOf(externalScriptContent) === -1);
            })
            .then(done)
            .catch(done);
    });

    it('bundle external script', (done) => {
        makeRollupBuild(externalScriptHtmlPath)
            .then(builder => builder.write({
                output: {
                    format: 'iife',
                    dir: distDir
                }
            }))
            .then(result => {
                const outputCode = result.output[0].code;
                assert.ok(outputCode.indexOf(firstHtmlPart) === 0);
                assert.ok(outputCode.indexOf(secondHtmlPart) !== -1);
                assert.ok(outputCode.indexOf(inlineScriptContent) === -1);
                assert.ok(outputCode.indexOf(externalScriptContent) !== -1);
            })
            .then(done)
            .catch(done);
    });

    it('bundle mixed script', (done) => {
        makeRollupBuild(mixedScriptHtmlPath)
            .then(builder => builder.write({
                output: {
                    format: 'iife',
                    dir: distDir
                }
            }))
            .then(result => {
                const outputCode = result.output[0].code;
                const inlineScriptContentStart = outputCode.indexOf(inlineScriptContent);
                const externalScriptContentStart = outputCode.indexOf(externalScriptContent);

                assert.ok(outputCode.indexOf(firstHtmlPart) === 0);
                assert.ok(outputCode.indexOf(secondHtmlPart) !== -1);
                assert.ok(inlineScriptContentStart !== -1);
                assert.ok(externalScriptContentStart !== -1);
                assert.ok(inlineScriptContentStart < externalScriptContentStart);
            })
            .then(done)
            .catch(done);
    });
});