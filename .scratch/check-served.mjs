const res = await fetch('http://localhost:3000/index.html?lesson=science-reading-1-seed');
const text = await res.text();
console.log('served has eliminate-pop:', text.includes('eliminate-pop'));
console.log('served has matched-pairs:', text.includes('matched-pairs'));
console.log('served has showEliminatePopup:', text.includes('showEliminatePopup'));
console.log('served has 种皮 lookup:', text.includes('word_bank'));
console.log('length:', text.length);
