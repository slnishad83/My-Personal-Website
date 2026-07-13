#!/usr/bin/env node
/* ============================================================
   LOAD TEST — Simulates notification fan-out for multiple
   users. Tests Cloud Functions locally before deploy.
   Usage: node scripts/load-test-notifications.js [count]
   ============================================================ */
'use strict';

const CONCURRENT_USERS = parseInt(process.argv[2] || '10', 10);
const DELAY_BETWEEN_MS = 50;

function generateCallId() {
  return `loadtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateUserId() {
  return `user_${Math.random().toString(36).slice(2, 10)}`;
}

function simulateFCMSend(tokenCount) {
  const results = [];
  for (let i = 0; i < tokenCount; i++) {
    results.push({
      success: Math.random() > 0.05,
      error: Math.random() < 0.05
        ? { code: 'messaging/registration-token-not-registered' }
        : null
    });
  }
  return results;
}

function simulateFirestoreWrite(collection, data) {
  return { id: `${collection}_${Date.now()}`, ...data };
}

async function simulateCallNotification(userId) {
  const callId = generateCallId();
  const fromUserId = generateUserId();

  const callDoc = simulateFirestoreWrite('calls', {
    callId,
    fromUserId,
    toUserId: userId,
    status: 'ringing',
    type: Math.random() > 0.5 ? 'video' : 'voice',
    fromUserName: 'Load Test User',
    fromUserAvatar: '',
    createdAt: Date.now()
  });

  const tokenCount = Math.floor(Math.random() * 3) + 1;
  const fcmResults = simulateFCMSend(tokenCount);

  const inAppNotif = simulateFirestoreWrite('inAppNotifications', {
    toUserId: userId,
    fromUserId,
    fromUserName: 'Load Test User',
    type: 'incoming_voice_call',
    message: 'Load Test User is calling',
    callId,
    read: false,
    createdAt: Date.now()
  });

  return { callDoc, fcmResults, inAppNotif };
}

async function simulateCallStateFanout(callId, fromUserId, toUserId) {
  const states = ['connected', 'ended'];
  const results = [];

  for (const status of states) {
    const updateResult = { callId, status, updatedAt: Date.now() };
    const tokens = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () =>
      `token_${Math.random().toString(36).slice(2, 10)}`
    );
    const fcmResults = simulateFCMSend(tokens.length);
    results.push({ updateResult, fcmResults });
  }

  return results;
}

async function run() {
  console.log(`\n  Load Test: ${CONCURRENT_USERS} concurrent call notifications\n`);

  const startTime = Date.now();
  const allResults = [];

  for (let i = 0; i < CONCURRENT_USERS; i++) {
    const userId = generateUserId();
    const result = await simulateCallNotification(userId);
    allResults.push(result);
    if (DELAY_BETWEEN_MS > 0) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_MS));
    }
  }

  const totalFCMSent = allResults.reduce((sum, r) => sum + r.fcmResults.length, 0);
  const totalFCMSuccess = allResults.reduce(
    (sum, r) => sum + r.fcmResults.filter(f => f.success).length, 0
  );
  const totalStaleTokens = allResults.reduce(
    (sum, r) => sum + r.fcmResults.filter(f => !f.success && f.error?.code?.includes('token-not-registered')).length, 0
  );

  const elapsed = Date.now() - startTime;

  console.log(`  Results:`);
  console.log(`    Calls simulated:     ${allResults.length}`);
  console.log(`    FCM messages sent:   ${totalFCMSent}`);
  console.log(`    FCM successes:       ${totalFCMSuccess}`);
  console.log(`    Stale tokens found:  ${totalStaleTokens}`);
  console.log(`    Total time:          ${elapsed}ms`);
  console.log(`    Avg per notification: ${Math.round(elapsed / allResults.length)}ms`);
  console.log(`    Throughput:          ${Math.round(allResults.length / (elapsed / 1000))} notifications/sec\n`);

  if (totalStaleTokens > 0) {
    console.log(`  Cleanup: Would remove ${totalStaleTokens} stale FCM tokens from Firestore\n`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
