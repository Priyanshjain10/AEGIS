// AEGIS Chrome Extension — Background Service Worker (MV3)
const AEGIS_APP_URL = 'https://aegis-deepfake-detector.netlify.app';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'aegis-scan',
    title: 'Scan with AEGIS — Deepfake Detector',
    contexts: ['image'],
  });
  console.log('[AEGIS] Extension installed.');
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'aegis-scan') return;
  const imageUrl = info.srcUrl;
  if (!imageUrl) return;

  // Bug 2 fix: send SCAN_INITIATED to current tab content script BEFORE opening new tab
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_INITIATED', imageUrl })
      .catch(() => {}); // content script may not be loaded on all pages — ignore error
  }

  // Bug 1 fix: open AEGIS with scanUrl param so UploadPage auto-loads the image
  const aegisUrl = `${AEGIS_APP_URL}?scanUrl=${encodeURIComponent(imageUrl)}`;
  chrome.tabs.create({ url: aegisUrl });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'AEGIS extension active', version: '1.0.0' });
  }
});
