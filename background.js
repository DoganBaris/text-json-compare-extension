// Extension ikonuna tıklandığında yeni pencere aç
chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 1500,
    height: 1000
  });
});
