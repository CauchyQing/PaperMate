const { app } = require('electron');
app.whenReady().then(() => {
  console.log('DOMMatrix:', typeof DOMMatrix);
  app.quit();
});
