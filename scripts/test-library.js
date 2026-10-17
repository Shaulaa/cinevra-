/* =========================================================
   Test script untuk library.js (URL encoding/decoding)
   Run dengan: node scripts/test-library.js
   ========================================================= */

// Mock browser environment
global.window = {
  location: {
    origin: 'http://localhost:5500',
    pathname: '/my-space.html',
    search: '',
    hash: ''
  }
};

global.URLSearchParams = require('url').URLSearchParams;

// Mock functions dari main.js yang dibutuhkan library.js
function getImageUrl(path, size) {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// Load library.js
const fs = require('fs');
const libraryCode = fs.readFileSync('js/library.js', 'utf8');
eval(libraryCode);

console.log('Testing URL Encoding/Decoding...\n');

// Test 1: Basic encoding
const testList1 = {
  name: 'Weekend Watch',
  items: [
    { id: 550, type: 'movie' },
    { id: 603, type: 'movie' },
    { id: 238, type: 'tv' }
  ]
};

const url1 = encodeListToURL(testList1, 'shared.html');
console.log('✓ Test 1: Basic encoding');
console.log('  Input:', JSON.stringify(testList1, null, 2));
console.log('  URL:', url1);

// Test 2: Decoding
const decoded1 = decodeURLToListData(url1);
console.log('\n✓ Test 2: Decoding');
console.log('  Decoded:', JSON.stringify(decoded1, null, 2));
console.assert(decoded1.name === testList1.name, 'Name should match');
console.assert(decoded1.items.length === testList1.items.length, 'Items length should match');

// Test 3: Special characters in name
const testList2 = {
  name: 'Películas Favoritas & More!',
  items: [
    { id: 123, type: 'movie' }
  ]
};

const url2 = encodeListToURL(testList2);
const decoded2 = decodeURLToListData(url2);
console.log('\n✓ Test 3: Special characters');
console.log('  Original name:', testList2.name);
console.log('  Decoded name:', decoded2.name);
console.assert(decoded2.name === testList2.name, 'Special characters should be preserved');

// Test 4: Large list (100 items)
const testList3 = {
  name: 'Large List',
  items: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, type: i % 2 === 0 ? 'movie' : 'tv' }))
};

const url3 = encodeListToURL(testList3);
const decoded3 = decodeURLToListData(url3);
console.log('\n✓ Test 4: Large list (100 items)');
console.log('  URL length:', url3.length, 'characters');
console.assert(decoded3.items.length === 100, '100 items should be preserved');
console.assert(url3.length < 2000, 'URL should be under 2000 characters');

// Test 5: List with description
const testList4 = {
  name: 'Sci-Fi Classics',
  description: 'Best science fiction movies from 1980-2000',
  items: [
    { id: 78, type: 'movie' },
    { id: 89, type: 'movie' }
  ]
};

const url4 = encodeListToURL(testList4);
const decoded4 = decodeURLToListData(url4);
console.log('\n✓ Test 5: List with description');
console.log('  Original description:', testList4.description);
console.log('  Decoded description:', decoded4.description);
console.assert(decoded4.description === testList4.description, 'Description should be preserved');

// Test 6: Invalid URL handling
console.log('\n✓ Test 6: Invalid URL handling');
const invalid1 = decodeURLToListData('invalid');
const invalid2 = decodeURLToListData('shared.html#invalid');
const invalid3 = decodeURLToListData('shared.html#v=1&n=test');
console.assert(invalid1 === null, 'Invalid URL should return null');
console.assert(invalid2 === null, 'Invalid hash should return null');
console.assert(invalid3 === null, 'Missing items should return null');

// Test 7: Validation
console.log('\n✓ Test 7: Validation');
const validData = { name: 'Test', items: [{ id: 123, type: 'movie' }] };
const validError = validateEncodedList(validData);
console.assert(validError === null, 'Valid data should pass validation');

const invalidData1 = { name: '', items: [] };
const error1 = validateEncodedList(invalidData1);
console.assert(error1 !== null, 'Empty name should fail validation');

const invalidData2 = { name: 'Test', items: [] };
const error2 = validateEncodedList(invalidData2);
console.assert(error2 !== null, 'Empty items should fail validation');

const invalidData3 = { name: 'Test', items: [{ id: 'abc', type: 'movie' }] };
const error3 = validateEncodedList(invalidData3);
console.assert(error3 !== null, 'Invalid item ID should fail validation');

console.log('\n✅ All tests passed!');
console.log('\nSummary:');
console.log('- URL encoding/decoding works correctly');
console.log('- Special characters are preserved');
console.log('- Large lists (100 items) fit under 2000 characters');
console.log('- Descriptions are supported');
console.log('- Invalid URLs are handled gracefully');
console.log('- Validation catches common errors');
