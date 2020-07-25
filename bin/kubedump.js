#!/usr/bin/env node

if (typeof require !== 'undefined' && require.main === module) {
  require('../lib/bin').default(process.argv).catch(console.error);
}
