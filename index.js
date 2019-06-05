const fs = require('fs');
const path = require('path');
const domUtils = require('domutils');
const { parseDOM } = require('htmlparser2');
const cache = {};

function isHtml(id) {
    return /\.html$/.test(id);
}

function buildInlineScriptId(htmlId, scriptIndex) {
    return '\0' + htmlId + '-' + scriptIndex;
}

module.exports = function() {
    const doms = {};
    const inlineScripts = {};
    const inlineScriptHtmlMap = {};

    function addInlineScriptHtmlMap(htmlId, inlineScriptId) {
        if (!inlineScriptHtmlMap[htmlId]) {
            inlineScriptHtmlMap[htmlId] = [];
        }
        inlineScriptHtmlMap[htmlId].push(inlineScriptId);
    }

    function removeInlineScriptCache(htmlId) {
        if (inlineScriptHtmlMap[htmlId]) {
            inlineScriptHtmlMap[htmlId].forEach(inlineScriptId => {
                delete inlineScripts[inlineScriptId];
            });
            inlineScriptHtmlMap[htmlId].length = 0;
            delete inlineScriptHtmlMap[htmlId];
        }  
    }

    function transformHtml(htmlId, htmlContent) {
        const dom = parseDOM(htmlContent);
        const scriptElements = domUtils.findAll(node => {
            return node.type === 'script' && node.name === 'script';
        }, dom);
        const code = scriptElements.map((scriptElement, scriptIndex) => {
            if (scriptElement.attribs.src) {
                domUtils.removeElement(scriptElement);
                return `import '${scriptElement.attribs.src}';`;
            } else {
                const firstChild = scriptElement.children[0];
                if (firstChild && firstChild.type === 'text') {
                    domUtils.removeElement(scriptElement);
                    const code = firstChild.data;
                    const id = buildInlineScriptId(htmlId, scriptIndex);
                    inlineScripts[id] = code;
                    addInlineScriptHtmlMap(htmlId, id);
                    return `import '${id}';`;
                }
            }
            return '';
        }).join('');
        return {
            dom,
            code
        };
    }

    return {
        resolveId(id) {
            if (inlineScripts[id]) {
                return id;
            }
        },
        load(id) {
            if (!isHtml(id)) {
                if (inlineScripts[id]) {
                    return inlineScripts[id];
                }
                return null;
            }

            const cacheData = cache[id];
            if (cacheData) {
                return cacheData.code;
            }

            return new Promise((resolve, reject) => {
                fs.readFile(id, 'utf8', (err, fileContent) => {
                    if (err) {
                        reject(new Error(`Could not resolve html entry ${id}.`));
                    } else {
                        resolve(fileContent);
                    }
                });
            }).then(fileContent => {
                const result = transformHtml(id, fileContent);
                cache[id] = result;
                doms[id] = result.dom;
                return result.code;
            });
        },

        generateBundle(outputOptions, outputBundle) {
            Object.keys(outputBundle).forEach(bundleName => {
                const bundle = outputBundle[bundleName];
                const {
                    facadeModuleId,
                    isEntry
                } = bundle;

                if (!isHtml(facadeModuleId) || !isEntry) {
                    return;
                }

                const dom = doms[facadeModuleId];
                if (!dom) {
                    return;
                }

                const body = domUtils.find(element => {
                    return element.type === 'tag' && element.name === 'body';
                }, dom, true, 1)[0];
                if (!body) {
                    return;
                }

                const scriptElement = {
                    type: 'script',
                    name: 'script',
                    children: [{
                        type: 'text',
                        data: bundle.code
                    }]
                };
                domUtils.appendChild(body, scriptElement);
                bundle.code = domUtils.getOuterHTML(dom);
                domUtils.removeElement(scriptElement);
                bundle.fileName = path.parse(facadeModuleId).base;
                delete outputBundle[bundleName];
                outputBundle[bundle.fileName] = bundle;
            });
        },

        watchChange(id) {
            let cacheData = cache[id];
            if (cacheData) {
                delete cache[id];
                Object.keys(cacheData).forEach(key => delete cacheData[key]);
                cacheData = null;
            }
            if (doms[id]) {
                delete doms[id];
            }
            removeInlineScriptCache(id);
        }
    }
}