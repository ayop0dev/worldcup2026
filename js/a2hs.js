(function () {
  var STORAGE_KEY = 'a2hs_dismissed';
  var SEVEN_DAYS  = 7 * 24 * 60 * 60 * 1000;

  // Desktop guard — belt-and-suspenders alongside CSS media query
  if (!window.matchMedia || !window.matchMedia('(max-width: 768px)').matches) return;

  // Standalone / installed-app mode — don't prompt again
  var isStandalone =
    navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) return;

  // Already dismissed within 7 days
  try {
    var ts = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    if (ts && Date.now() - ts < SEVEN_DAYS) return;
  } catch (_) {}

  var banner         = document.getElementById('a2hsBanner');
  var modal          = document.getElementById('a2hsModal');
  var howBtn         = document.getElementById('a2hsHow');
  var laterBtn       = document.getElementById('a2hsLater');
  var closeBtn       = document.getElementById('a2hsModalClose');
  var iosSection     = document.getElementById('a2hsStepsIos');
  var androidSection = document.getElementById('a2hsStepsAndroid');

  if (!banner || !modal) return;

  // Device detection
  var ua        = navigator.userAgent;
  var isIos     = /iphone|ipad|ipod/i.test(ua) ||
                  (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /android/i.test(ua);
  var deviceLabel = isIos ? 'ios' : isAndroid ? 'android' : 'unknown';

  // Hide irrelevant instruction section
  if (isIos && !isAndroid && androidSection) androidSection.style.display = 'none';
  if (isAndroid && !isIos && iosSection)     iosSection.style.display     = 'none';

  // Safe GTM tracking — app.js defines track(), but guard anyway
  function _track(event, params) {
    try { if (typeof track === 'function') track(event, params); } catch (_) {}
  }

  var dismissed = false;

  // Show banner
  banner.style.display = 'block';
  _track('a2hs_banner_shown', { device: deviceLabel });

  // "طريقة الإضافة" → hide banner, open modal
  if (howBtn) {
    howBtn.addEventListener('click', function () {
      banner.style.display = 'none';
      modal.classList.add('open');
      _track('a2hs_instructions_opened', { device: deviceLabel });
    });
  }

  // Dismiss: hide permanently for 7 days
  function dismiss() {
    dismissed = true;
    banner.style.display = 'none';
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (_) {}
    _track('a2hs_banner_dismissed', { device: deviceLabel });
  }

  if (laterBtn) laterBtn.addEventListener('click', dismiss);

  // Close modal: restore banner only if not dismissed
  function closeModal() {
    modal.classList.remove('open');
    if (!dismissed) banner.style.display = 'block';
  }
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });
}());
