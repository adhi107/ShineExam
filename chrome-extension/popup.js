document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('openPortalBtn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: 'http://localhost:3000' });
      } else {
        window.open('http://localhost:3000', '_blank');
      }
    });
  }
});
