# rollup-plugin-html-input
Rollup plugin to use HTML files as input.

## Installation

```bash
npm install --save-dev rollup-plugin-html-input
```

## Usage

```javascript
// rollup.config.js
const htmlPlugin = require('rollup-plugin-html-input');

module.exports = {
    input: 'index.html',
    output: {
        format: 'iife',
        dir: './dist'
    }
    plugins: [
        htmlPlugin()
    ]
}
```

### Demo

#### source

`index.html`

```html
<!DOCTYPE html>
<html>
<head>
    <title>Index</title>
</head>
<body>
    <script>
        console.log("from inline script");
    </script>
    <script src="./external.js"></script>
</body>
</html>
```
`external.js`

```javascript
console.log("from external script");
```
#### rollup config

`rollup.config.js`

```javascript
const htmlPlugin = require('rollup-plugin-html-input');

module.exports = {
    input: 'index.html',
    output: {
        format: 'iife',
        dir: './dist'
    }
    plugins: [
        htmlPlugin()
    ]
}
```

#### output

`index.html`
```html
<!DOCTYPE html>
<html>
<head>
    <title>Index</title>
</head>
<body>
<script>(function () {
    'use strict';

    console.log("from inline script");

    console.log("from external script");

}());
</script></body>
</html>
```
