// AEGIS Chrome Extension — Content Script
// Runs on every webpage. Adds visual indicator when AEGIS scans an image.

(function () {
  'use strict';

  const AEGIS_BADGE_CLASS = 'aegis-scan-badge';
  let activeToast = null;

  // Listen for scan trigger from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SCAN_INITIATED') {
      showToast(`AEGIS scanning: ${message.imageUrl.slice(0, 60)}...`);
    }
  });

  // Show a non-intrusive toast notification
  function showToast(text) {
    if (activeToast) activeToast.remove();

    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(0, 8, 20, 0.95);
      color: #00f5ff;
      border: 1px solid rgba(0, 245, 255, 0.4);
      padding: 12px 18px;
      font-family: 'Share Tech Mono', monospace, sans-serif;
      font-size: 12px;
      border-radius: 4px;
      z-index: 999999;
      box-shadow: 0 0 12px rgba(0, 245, 255, 0.2);
      letter-spacing: 0.05em;
      max-width: 360px;
      word-break: break-all;
      transition: opacity 0.3s ease;
    `;
    toast.textContent = `⬡ AEGIS — ${text}`;
    document.body.appendChild(toast);
    activeToast = toast;

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Add subtle hover indicator to images
  document.addEventListener('mouseover', (e) => {
    if (e.target.tagName !== 'IMG') return;
    const img = e.target;
    if (img.dataset.aegisHover) return;
    img.dataset.aegisHover = 'true';
    img.title = (img.title ? img.title + ' | ' : '') + 'Right-click to scan with AEGIS';
  });

  console.log('[AEGIS] Content script loaded. Right-click any image to scan.');
})();
