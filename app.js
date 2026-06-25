/**
 * app.js
 * -----------------------------------------------------------------------
 * Frontend logic for the Playwright login test runner UI.
 *
 * Flow:
 *   1. User enters an email and clicks Submit.
 *   2. We POST { email } to /api/run-test on the Express backend.
 *   3. The backend runs the existing Playwright suite (passing the email
 *      through as UI_EMAIL) and waits for it to finish.
 *   4. We render the returned status / duration / error, and if a video
 *      was recorded, load it into the <video> player below the result.
 *
 * This file only talks to our own backend — it has no knowledge of
 * Playwright, Page Objects, or the CSV file. That separation is what lets
 * the existing automation project stay untouched.
 * -----------------------------------------------------------------------
 */

(function () {
  'use strict';

  // ---- Element references -------------------------------------------------
  const form = document.getElementById('run-form');
  const emailInput = document.getElementById('email');
  const submitBtn = document.getElementById('submit-btn');

  const runStatus = document.getElementById('run-status');
  const runStatusFill = document.getElementById('run-status-fill');
  const runStatusText = document.getElementById('run-status-text');

  const resultCard = document.getElementById('result-card');
  const resultStatusBadge = document.getElementById('result-status-badge');
  const resultDuration = document.getElementById('result-duration');
  const resultErrorRow = document.getElementById('result-error-row');
  const resultError = document.getElementById('result-error');

  const videoCard = document.getElementById('video-card');
  const resultVideo = document.getElementById('result-video');

  // Friendly, rotating status messages while the suite is running so the
  // page doesn't feel frozen during what can be a multi-second test run.
  const RUNNING_MESSAGES = [
    'Launching the browser…',
    'Navigating to the site…',
    'Submitting login credentials…',
    'Waiting for the test to finish…',
  ];

  let messageInterval = null;

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function formatDuration(ms) {
    if (typeof ms !== 'number' || Number.isNaN(ms)) return '—';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  function setRunningUI(isRunning) {
    submitBtn.disabled = isRunning;
    emailInput.disabled = isRunning;
    submitBtn.classList.toggle('button--loading', isRunning);

    if (isRunning) {
      runStatus.classList.remove('run-status--hidden');
      runStatusFill.className = 'run-status__fill'; // reset to indeterminate state
      let i = 0;
      runStatusText.textContent = RUNNING_MESSAGES[0];
      messageInterval = setInterval(() => {
        i = (i + 1) % RUNNING_MESSAGES.length;
        runStatusText.textContent = RUNNING_MESSAGES[i];
      }, 1800);
    } else {
      clearInterval(messageInterval);
    }
  }

  function showResult({ status, durationMs, errorMessage, videoUrl }) {
    // Lock the status bar to a solid pass/fail color instead of hiding it,
    // so it doubles as an at-a-glance outcome indicator.
    runStatusFill.className = `run-status__fill run-status__fill--${status}`;
    runStatusText.textContent = status === 'passed' ? 'Test run completed successfully.' : 'Test run finished with a failure.';

    resultCard.classList.remove('card--hidden');

    resultStatusBadge.textContent = status === 'passed' ? 'Passed' : 'Failed';
    resultStatusBadge.className = `badge badge--${status === 'passed' ? 'passed' : 'failed'}`;

    resultDuration.textContent = formatDuration(durationMs);

    if (errorMessage) {
      resultError.textContent = errorMessage;
      resultErrorRow.classList.add('result-grid__row--visible');
    } else {
      resultErrorRow.classList.remove('result-grid__row--visible');
    }

    if (videoUrl) {
      resultVideo.src = videoUrl;
      videoCard.classList.remove('card--hidden');
    } else {
      videoCard.classList.add('card--hidden');
    }
  }

  function showSubmissionError(message) {
    runStatus.classList.add('run-status--hidden');
    resultCard.classList.remove('card--hidden');
    resultStatusBadge.textContent = 'Failed';
    resultStatusBadge.className = 'badge badge--failed';
    resultDuration.textContent = '—';
    resultError.textContent = message;
    resultErrorRow.classList.add('result-grid__row--visible');
    videoCard.classList.add('card--hidden');
  }

  async function runTest(email) {
    setRunningUI(true);

    try {
      const response = await fetch('/api/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        showSubmissionError(data.errorMessage || 'The test could not be started.');
        return;
      }

      showResult(data);
    } catch (err) {
      showSubmissionError('Could not reach the test server. Is it running?');
    } finally {
      setRunningUI(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();

    if (!isValidEmail(email)) {
      emailInput.classList.add('field__input--invalid');
      emailInput.focus();
      return;
    }

    emailInput.classList.remove('field__input--invalid');
    runTest(email);
  });

  emailInput.addEventListener('input', () => {
    emailInput.classList.remove('field__input--invalid');
  });
})();
