// Popup script
document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOM Content Loaded');
  
  const tabsList = document.getElementById('tabs-list');
  const bookmarksList = document.getElementById('bookmarks-list');
  const chromeList = document.getElementById('chrome-list');
  const searchInput = document.getElementById('search-input');
  
  console.log('Elements found:', {
    tabsList: !!tabsList,
    bookmarksList: !!bookmarksList,
    chromeList: !!chromeList,
    searchInput: !!searchInput
  });
  
  let allTabs = [];
  let internalPageElements = [];
  let bookmarkElements = [];
  
  // Common Chrome internal pages
  const chromeInternalPages = [
    { title: 'Extensions', url: 'chrome://extensions/' },
    { title: 'Settings', url: 'chrome://settings/' },
    { title: 'Downloads', url: 'chrome://downloads/' },
    { title: 'History', url: 'chrome://history/' },
    { title: 'Bookmarks', url: 'chrome://bookmarks/' },
    { title: 'Chrome Apps', url: 'chrome://apps/' },
    { title: 'Password Manager', url: 'chrome://passwords/' },
    { title: 'Chrome Flags', url: 'chrome://flags/' },
    { title: 'System Info', url: 'chrome://system/' },
    { title: 'Network Status', url: 'chrome://net-internals/' },
    { title: 'Memory Usage', url: 'chrome://memory/' },
    { title: 'Chrome Version', url: 'chrome://version/' }
  ];
  
  console.log('Fetching tabs...');
  // Get all tabs
  const tabs = await chrome.tabs.query({});
  console.log('Tabs fetched successfully');
  
  // Log tabs in a readable format
  console.log('=== Open Tabs ===');
  tabs.forEach((tab, index) => {
    console.log(`\nTab ${index + 1}:`);
    console.log(`Title: ${tab.title}`);
    console.log(`URL: ${tab.url}`);
    console.log(`ID: ${tab.id}`);
    console.log(`Window ID: ${tab.windowId}`);
    console.log(`Active: ${tab.active}`);
    console.log(`Index: ${tab.index}`);
    console.log(`Favicon URL: ${tab.favIconUrl || 'None'}`);
    console.log('-------------------');
  });
  console.log(`\nTotal tabs: ${tabs.length}`);
  
  function getFaviconUrl(url) {
    // Handle chrome:// URLs
    if (url.startsWith('chrome://')) {
      return 'icons/icon16.png';
    }
    // For regular URLs, use Google's favicon service
    return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(new URL(url).hostname)}`;
  }
  
  // Function to get the full path of a bookmark
  async function getBookmarkPath(bookmarkId) {
    const path = [];
    let currentId = bookmarkId;
    
    while (currentId) {
      const [bookmark] = await chrome.bookmarks.get(currentId);
      if (!bookmark) break;
      
      // Skip root folders
      if (bookmark.parentId === "0" || bookmark.parentId === "1") break;
      
      path.unshift(bookmark.title);
      currentId = bookmark.parentId;
    }
    
    return path.join(' / ');
  }

  // Function to create a tab element
  function createTabElement(tab, type = 'tab') {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab-item';
    
    // Add favicon
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = getFaviconUrl(tab.url);
    favicon.onerror = () => {
      favicon.src = chrome.runtime.getURL('icons/icon48.png');
    };
    
    // Add title
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title;
    
    // Add elements based on type
    if (type === 'chrome') {
      const badge = document.createElement('span');
      badge.className = 'chrome-badge';
      badge.textContent = 'chrome://';
      tabElement.appendChild(badge);
    } else if (type === 'bookmark') {
      const badge = document.createElement('span');
      badge.className = 'bookmark-badge';
      badge.textContent = '*';
      tabElement.appendChild(badge);
      
      // Add folder path for bookmarks
      if (tab.folderPath) {
        console.log('Folder path:', tab.folderPath);
        const pathElement = document.createElement('span');
        pathElement.className = 'bookmark-path';
        pathElement.textContent = tab.folderPath;
        tabElement.appendChild(pathElement);
      }
    }
    
    tabElement.appendChild(favicon);
    tabElement.appendChild(title);
    
    // Add close button only for regular tabs
    if (type === 'tab') {
      const closeButton = document.createElement('div');
      closeButton.className = 'close-button';
      closeButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
      closeButton.title = 'Close tab';
      
      // Handle close button click
      closeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent tab activation when closing
        chrome.tabs.remove(tab.id, () => {
          tabElement.remove();
          // If this was the last tab in the panel, hide the panel
          const tabsPanel = document.getElementById('tabs-panel');
          if (!tabsPanel.querySelector('.tab-item:not(.hidden)')) {
            tabsPanel.style.display = 'none';
          }
        });
      });
      
      tabElement.appendChild(closeButton);
    }
    
    // Add click handler for navigation
    tabElement.addEventListener('click', () => {
      if (type === 'tab') {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: tab.url });
      }
      window.close();
    });
    
    return tabElement;
  }

  // Function to process bookmarks
  async function processBookmarks(bookmarkNodes) {
    const bookmarkElements = [];
    
    for (const node of bookmarkNodes) {
      // Skip root folders
      if (node.id === "0" || node.id === "1") {
        if (node.children) {
          bookmarkElements.push(...await processBookmarks(node.children));
        }
        continue;
      }

      if (node.url) {
        const folderPath = await getBookmarkPath(node.id);
        const bookmarkData = { 
          title: node.title, 
          url: node.url,
          folderPath: folderPath
        };
        bookmarkElements.push({
          tab: bookmarkData,
          element: createTabElement(bookmarkData, 'bookmark')
        });
      }
      
      if (node.children) {
        bookmarkElements.push(...await processBookmarks(node.children));
      }
    }
    
    return bookmarkElements;
  }

  function filterTabs(searchTerm) {
    const regex = new RegExp(searchTerm, 'i');
    let hasVisibleTabs = false;
    let hasVisibleBookmarks = false;
    let hasVisibleChrome = false;
    
    // Filter regular tabs
    allTabs.forEach(({ tab, element }) => {
      if (regex.test(tab.title) || regex.test(tab.url)) {
        element.classList.remove('hidden');
        hasVisibleTabs = true;
      } else {
        element.classList.add('hidden');
      }
    });

    // Only show matching internal pages and bookmarks when there's a search term
    if (searchTerm) {
      // Filter internal pages
      internalPageElements.forEach(({ tab, element }) => {
        if (regex.test(tab.title) || regex.test(tab.url)) {
          element.classList.remove('hidden');
          hasVisibleChrome = true;
        } else {
          element.classList.add('hidden');
        }
      });

      // Filter bookmarks
      bookmarkElements.forEach(({ tab, element }) => {
        if (regex.test(tab.title) || regex.test(tab.url)) {
          element.classList.remove('hidden');
          hasVisibleBookmarks = true;
        } else {
          element.classList.add('hidden');
        }
      });
    } else {
      // Hide all internal pages and bookmarks when search is empty
      internalPageElements.forEach(({ element }) => {
        element.classList.add('hidden');
      });
      bookmarkElements.forEach(({ element }) => {
        element.classList.add('hidden');
      });
    }

    // Show/hide panels based on content
    document.getElementById('tabs-panel').style.display = hasVisibleTabs ? 'block' : 'none';
    document.getElementById('bookmarks-panel').style.display = hasVisibleBookmarks ? 'block' : 'none';
    document.getElementById('chrome-panel').style.display = hasVisibleChrome ? 'block' : 'none';
  }

  // Create and append tab elements for open tabs
  tabs.forEach(tab => {
    const tabElement = createTabElement(tab);
    allTabs.push({ tab, element: tabElement });
    tabsList.appendChild(tabElement);
  });

  // Create and append internal pages (initially hidden)
  chromeInternalPages.forEach(internalPage => {
    const tabElement = createTabElement(internalPage, 'chrome');
    internalPageElements.push({ tab: internalPage, element: tabElement });
    chromeList.appendChild(tabElement);
  });

  // Get and process bookmarks
  const bookmarks = await chrome.bookmarks.getTree();
  bookmarkElements = await processBookmarks(bookmarks);
  bookmarkElements.forEach(({ element }) => {
    bookmarksList.appendChild(element);
  });

  // Add search functionality
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.trim();
    try {
      filterTabs(searchTerm);
    } catch (error) {
      // If invalid regex, treat as plain text
      filterTabs(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  });

  // Initial filter to hide panels
  filterTabs('');

  // Focus search input when popup opens
  searchInput.focus();

  // Add this after the DOMContentLoaded event listener setup
  const showThumbnailsButton = document.getElementById('show-thumbnails');
  const thumbnailsOverlay = document.getElementById('thumbnails-overlay');
  const closeThumbnailsButton = document.getElementById('close-thumbnails');
  const thumbnailsGrid = document.getElementById('thumbnails-grid');

  async function captureTab(tab) {
    try {
      // Switch to the tab first
      await chrome.tabs.update(tab.id, { active: true });
      await new Promise(resolve => setTimeout(resolve, 150)); // Give the tab time to load

      // Capture the visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 50
      });

      return dataUrl;
    } catch (error) {
      console.error('Error capturing tab:', error);
      return null;
    }
  }

  async function showThumbnails() {
    thumbnailsGrid.innerHTML = ''; // Clear existing thumbnails
    thumbnailsOverlay.classList.remove('hidden');

    // Get all tabs
    const tabs = await chrome.tabs.query({});
    const currentTab = tabs.find(tab => tab.active);
    
    // Get the extension ID to filter out the extension popup
    const extensionId = chrome.runtime.id;
    
    // Filter out the extension popup tab
    const filteredTabs = tabs.filter(tab => {
      return !tab.url.includes(extensionId) && !tab.url.startsWith('chrome-extension://');
    });
    
    for (const tab of filteredTabs) {
      const thumbnailItem = document.createElement('div');
      thumbnailItem.className = 'thumbnail-item';
      
      const image = document.createElement('img');
      image.className = 'thumbnail-image';
      image.alt = tab.title;
      
      const title = document.createElement('div');
      title.className = 'thumbnail-title';
      title.textContent = tab.title;
      
      thumbnailItem.appendChild(image);
      thumbnailItem.appendChild(title);
      thumbnailsGrid.appendChild(thumbnailItem);

      // Capture screenshot
      const screenshot = await captureTab(tab);
      if (screenshot) {
        image.src = screenshot;
      } else {
        image.src = getFaviconUrl(tab.url);
      }

      // Add click handler
      thumbnailItem.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
        window.close();
      });
    }

    // Switch back to the original tab
    if (currentTab && !currentTab.url.includes(extensionId)) {
      await chrome.tabs.update(currentTab.id, { active: true });
    }
  }

  // Add event listeners for thumbnail functionality
  showThumbnailsButton.addEventListener('click', showThumbnails);
  
  closeThumbnailsButton.addEventListener('click', () => {
    thumbnailsOverlay.classList.add('hidden');
  });

  // Close overlay when clicking outside the content
  thumbnailsOverlay.addEventListener('click', (e) => {
    if (e.target === thumbnailsOverlay) {
      thumbnailsOverlay.classList.add('hidden');
    }
  });

  // Add ESC key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !thumbnailsOverlay.classList.contains('hidden')) {
      thumbnailsOverlay.classList.add('hidden');
    }
  });
}); 