// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Listen for any messages from content script if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle any messages here
});

// Background service worker
let popupWindowId = null;
let isPopupOpening = false;

chrome.action.onClicked.addListener(async () => {
  // If there's already a popup window, focus it instead of creating a new one
  if (popupWindowId !== null) {
    chrome.windows.update(popupWindowId, { focused: true });
    return;
  }

  // Get the current window to calculate dimensions
  const currentWindow = await chrome.windows.getCurrent();
  
  // Calculate dimensions (80% of the current window)
  const width = Math.round(currentWindow.width * 0.8);
  const height = Math.round(currentWindow.height * 0.8);
  
  // Calculate position to center the window
  const left = Math.round(currentWindow.left + (currentWindow.width - width) / 2);
  const top = Math.round(currentWindow.top + (currentWindow.height - height) / 2);

  // Set flag to prevent immediate closing
  isPopupOpening = true;

  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: width,
    height: height,
    left: left,
    top: top,
    focused: true
  }, (window) => {
    popupWindowId = window.id;
    // Reset the flag after a short delay
    setTimeout(() => {
      isPopupOpening = false;
    }, 500);
  });
});

// Listen for window removal
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
  }
});

// Listen for window focus change
chrome.windows.onFocusChanged.addListener((windowId) => {
  // Don't close if we're in the process of opening
  if (isPopupOpening) return;

  // chrome.windows.WINDOW_ID_NONE means no window is focused
  // If the focused window is not our popup, close the popup
  if (popupWindowId !== null && 
      windowId !== popupWindowId && 
      windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.windows.remove(popupWindowId);
    popupWindowId = null;
  }
}); 