'use strict';

const upstream = require('brace-expansion-v5');

if (typeof upstream?.expand !== 'function') {
  throw new TypeError('brace-expansion-v5 must expose a callable expand function');
}

module.exports = upstream.expand;
module.exports.expand = upstream.expand;
module.exports.EXPANSION_MAX = upstream.EXPANSION_MAX;
module.exports.EXPANSION_MAX_LENGTH = upstream.EXPANSION_MAX_LENGTH;
