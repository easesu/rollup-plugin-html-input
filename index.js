const fs = require('fs');
const path = require('path');
const domUtils = require('domutils');
const { parseDOM } = require('htmlparser2');
const cache = {};

function isHtml(id) {
    return /\.html$/.test(id);
}

module.exports = function() {
    const doms = {};

    function transformHtml(htmlContent) {
        const dom = parseDOM(htmlContent);
        const scriptElements = domUtils.findAll(node => {
            return node.type === 'script' && node.name === 'script';
        }, dom);
        const code = scriptElements.map(scriptElement => {
            if (scriptElement.attribs.src) {
                domUtils.removeElement(scriptElement);
                return `import '${scriptElement.attribs.src}';\n`;
            } else {
                const firstChild = scriptElement.children[0];
                if (firstChild && firstChild.type === 'text') {
                    domUtils.removeElement(scriptElement);
                    return firstChild.data;
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
        load(id) {
            if (!isHtml(id)) {
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
                const result = transformHtml(fileContent);
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

                domUtils.appendChild(body, {
                    type: 'script',
                    name: 'script',
                    children: [{
                        type: 'text',
                        data: bundle.code
                    }]
                });
                bundle.code = domUtils.getOuterHTML(dom);
                bundle.fileName = path.parse(facadeModuleId).base;
                delete outputBundle[bundleName];
                outputBundle[bundle.fileName] = bundle;
            });
        },

        watchChange(id) {
            const cacheData = cache[id];
            if (cacheData) {
                delete cache[id];
                Object.keys(cacheData).forEach(key => delete cacheData[key]);
                cacheData = null;
            }
            if (doms[id]) {
                delete doms[id];
            }
        }
    }
}