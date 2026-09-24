/* Removed - Bluetooth eliminated, kept as no-op for compatibility */
window.CCNearby = {
  isNative: false,
  bleAvailable: false,
  init: function(){ return Promise.resolve(false); },
  advertiseCode: function(){ return Promise.resolve(false); },
  stop: function(){ return Promise.resolve(); }
};
