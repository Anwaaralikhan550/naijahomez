#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');

// Cron gives this script a bare environment. Without loading .env.local the
// send-window check below fell back to the built-in 09:00-11:00 default and
// logged a window the worker was not actually using, since the worker does
// read .env.local. Load it before anything reads process.env.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

const { describeSendWindow, evaluateSendWindow } = require('../src/lib/automation/send-window.cjs');

const projectRoot = path.resolve(__dirname, '..');
const logsDir = process.env.SCRAPER_LOG_DIR || path.join(projectRoot, 'logs');
const logFile = path.join(logsDir, 'scraping-daily.log');
const lockFile = path.join(logsDir, '.daily-scrape-onboarding.lock');

function ensureLogsDir() {
  fs.mkdirSync(logsDir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString();
}

function log(message) {
  ensureLogsDir();
  const line = `[${timestamp()}] ${message}`;
  fs.appendFileSync(logFile, `${line}\n`);
  console.log(line);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    skipOnboarding: argv.includes('--skip-onboarding')
  };
}

function isExplicitFalse(value) {
  return ['0', 'false', 'no', 'off'].includes(String(value || '').trim().toLowerCase());
}

function isExplicitTrue(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isProductionPipeline() {
  return process.env.NODE_ENV === 'production' ||
    isExplicitTrue(process.env.DAILY_PIPELINE_PRODUCTION);
}

function acquireLock() {
  ensureLogsDir();
  try {
    const fd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(fd, JSON.stringify({
      pid: process.pid,
      startedAt: timestamp()
    }, null, 2));
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      log('Another daily scrape/onboarding job is already running. Exiting safely.');
      return false;
    }
    throw error;
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(lockFile);
  } catch {
    // Nothing to release.
  }
}

function runCommand(label, command, args, options = {}) {
  return new Promise((resolve) => {
    log(`START ${label}: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...options.env
      },
      windowsHide: true,
      shell: false
    });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      fs.appendFileSync(logFile, chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      fs.appendFileSync(logFile, chunk);
      process.stderr.write(chunk);
    });
    child.on('error', (error) => {
      log(`ERROR ${label}: ${error.message}`);
      resolve({ code: 1, error });
    });
    child.on('close', (code) => {
      log(`END ${label}: exit=${code}`);
      resolve({ code });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureLogsDir();

  if (!acquireLock()) return;

  try {
    log('Daily scraping and WhatsApp onboarding pipeline started.');
    const productionPipeline = isProductionPipeline();
    const dryRun = args.dryRun && (!productionPipeline || isExplicitTrue(process.env.ALLOW_DAILY_DRY_RUN));
    const skipOnboarding = args.skipOnboarding &&
      (!productionPipeline || isExplicitTrue(process.env.ALLOW_DAILY_SKIP_ONBOARDING));

    if (args.dryRun && !dryRun) {
      log('Ignoring --dry-run because the daily pipeline is running in production mode.');
    }
    if (args.skipOnboarding && !skipOnboarding) {
      log('Ignoring --skip-onboarding because the daily pipeline is running in production mode.');
    }

    const scraperLimit = String(process.env.DAILY_SCRAPER_LIMIT || 50);
    const scraperDelayMs = String(process.env.DAILY_SCRAPER_DELAY_MS || 800);
    const scraperMaxAgeDays = String(process.env.DAILY_SCRAPER_MAX_AGE_DAYS || 60);
    const shouldFetchDetails = !isExplicitFalse(process.env.DAILY_SCRAPER_DETAIL);
    const propertyListingType = process.env.DAILY_PROPERTY_LISTING_TYPE || 'both';
    const scraperArgs = [
      'scripts/live-scraper.js',
      '--source',
      process.env.DAILY_SCRAPER_SOURCE || 'all',
      '--category',
      process.env.DAILY_SCRAPER_CATEGORY || 'property',
      '--limit',
      scraperLimit,
      '--listing-type',
      propertyListingType,
      '--delay-ms',
      scraperDelayMs,
      '--max-age-days',
      scraperMaxAgeDays,
      '--save'
    ];
    if (shouldFetchDetails) scraperArgs.push('--detail');
    if (dryRun) scraperArgs.push('--dry-run');

    const scrapeResult = await runCommand('scraper', process.execPath, scraperArgs);

    const fallbackArgs = [
      'scripts/generate-properties-fallback.js',
      '--source',
      process.env.DAILY_SCRAPER_SOURCE || 'all',
      '--category',
      process.env.DAILY_SCRAPER_CATEGORY || 'property',
      '--limit',
      scraperLimit,
      '--listing-type',
      propertyListingType,
      '--delay-ms',
      scraperDelayMs,
      '--max-age-days',
      scraperMaxAgeDays
    ];
    if (shouldFetchDetails) fallbackArgs.push('--detail');
    const fallbackResult = await runCommand('properties-fallback-cache', process.execPath, fallbackArgs);
    if (fallbackResult.code !== 0) {
      log(`WARNING: properties fallback cache generation failed with exit code ${fallbackResult.code}.`);
    }

    if (scrapeResult.code !== 0) {
      log(`FAILURE: scraper failed with exit code ${scrapeResult.code}. WhatsApp onboarding skipped.`);
      process.exitCode = scrapeResult.code || 1;
      return;
    }

    if (skipOnboarding) {
      log('Onboarding skipped by --skip-onboarding flag.');
      return;
    }

    // Scraping runs overnight, but messages must not. The dedicated send-window
    // cron drains whatever this run queued once Lagos business hours open.
    const sendWindow = evaluateSendWindow();
    if (!dryRun && !sendWindow.open) {
      log(
        `Outreach queued but not sent: outside send window ${describeSendWindow(sendWindow.window)} ` +
        `(local hour ${sendWindow.localHour}). The send-window job will drain the queue.`
      );
      return;
    }

    const graceSeconds = Number(process.env.DAILY_ONBOARDING_GRACE_SECONDS || (dryRun ? 3 : 70));
    if (graceSeconds > 0) {
      log(`Waiting ${graceSeconds}s for newly queued outreach jobs to become due.`);
      await sleep(graceSeconds * 1000);
    }

    const delayMin = String(process.env.DAILY_ONBOARDING_DELAY_MIN_SECONDS || 6);
    const delayMax = String(process.env.DAILY_ONBOARDING_DELAY_MAX_SECONDS || 16);
    const maxJobs = String(process.env.DAILY_ONBOARDING_MAX_JOBS || scraperLimit);
    const workerArgs = [
      'scripts/run-onboarding-worker.js',
      '--drain',
      `--delay-min=${delayMin}`,
      `--delay-max=${delayMax}`,
      `--max-jobs=${maxJobs}`,
      '--empty-grace-ms=20000'
    ];
    if (dryRun) workerArgs.push('--dry-run');

    const onboardingResult = await runCommand('whatsapp-onboarding', process.execPath, workerArgs, {
      env: {
        ONBOARDING_DELAY_MIN_SECONDS: delayMin,
        ONBOARDING_DELAY_MAX_SECONDS: delayMax,
        ONBOARDING_MAX_JOBS: maxJobs,
        MAX_HOURLY_MESSAGES: process.env.DAILY_MAX_HOURLY_MESSAGES || process.env.MAX_HOURLY_MESSAGES || '50',
        MAX_DAILY_MESSAGES: process.env.DAILY_MAX_DAILY_MESSAGES || process.env.MAX_DAILY_MESSAGES || '100'
      }
    });

    if (onboardingResult.code !== 0) {
      log(`FAILURE: WhatsApp onboarding failed with exit code ${onboardingResult.code}.`);
      process.exitCode = onboardingResult.code || 1;
      return;
    }

    log('Daily scraping and WhatsApp onboarding pipeline completed successfully.');
  } finally {
    releaseLock();
  }
}

main().catch((error) => {
  log(`FATAL: ${error.message}`);
  releaseLock();
  process.exit(1);
});
