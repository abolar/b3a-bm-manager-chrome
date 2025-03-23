// Create popup element
const popup = document.createElement('div');
popup.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  z-index: 10000;
  font-family: Arial, sans-serif;
`;


// Add close button
const closeButton = document.createElement('button');
closeButton.textContent = '×';
closeButton.style.cssText = `
  position: absolute;
  top: 5px;
  right: 5px;
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
  padding: 0 5px;
`;

closeButton.addEventListener('click', () => {
  popup.remove();
});

popup.appendChild(closeButton);

// Add to page
document.body.appendChild(popup);

// Auto-remove after 5 seconds
setTimeout(() => {
  if (document.body.contains(popup)) {
    popup.remove();
  }
}, 5000); 