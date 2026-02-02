# Firestore Reads Optimization Guide

## Problem: Excessive Firestore Reads (44K/hour)

The main causes of excessive reads are:
1. **Polling intervals** - Components checking for updates even when nothing changed
2. **Loading all data upfront** - Comments, messages, etc. loaded even if not needed
3. **Multiple listeners** - Each component creates its own listener

## Solution: Replace Polling with Real-time Listeners

### ❌ BAD: Polling (Current Implementation)
```javascript
useEffect(() => {
  loadMessages();
  const interval = setInterval(loadMessages, 1000); // 3,600 reads/hour!
  return () => clearInterval(interval);
}, []);
```

### ✅ GOOD: Server-Side Listeners with SSE
```javascript
// Use the custom hook
import { useFirestoreSSE } from '@/hooks/useFirestoreSSE';

// In your component
const { data: messages, connectionStatus } = useFirestoreSSE(
  '/api/hub/chat/messages/stream',
  { communityId, channelId },
  (changes) => {
    // Custom update handler if needed
  }
);
```

## Components That Need Conversion

### 1. CommunityChat (3,600 reads/hour)
- **Current**: Polls every 1 second
- **Fix**: Use `/api/hub/chat/messages/stream` SSE endpoint
- **Savings**: 99% reduction

### 2. PrivateMessages (1,920 reads/hour)
- **Current**: Polls conversations (5s) + messages (3s)
- **Fix**: Create SSE endpoints for conversations and messages
- **Savings**: 95% reduction

### 3. EmergencyAlerts (120 reads/hour)
- **Current**: Polls every 30 seconds
- **Fix**: SSE endpoint for emergency alerts
- **Savings**: Only charges when new alerts arrive

### 4. Notifications (60 reads/hour)
- **Current**: Polls every minute
- **Fix**: SSE endpoint for notifications
- **Savings**: Only charges for actual new notifications

## Implementation Steps

### Step 1: Create SSE Endpoint
```javascript
// /api/hub/[feature]/stream/route.js
export async function GET(request) {
  const stream = new ReadableStream({
    start(controller) {
      // Set up Firestore listener
      const unsubscribe = db.collection('yourCollection')
        .where('communityId', '==', communityId)
        .where('createdAt', '>', new Date()) // Only new items
        .onSnapshot((snapshot) => {
          const changes = snapshot.docChanges();
          if (changes.length > 0) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'update', changes })}\n\n`
            ));
          }
        });

      return () => unsubscribe();
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Step 2: Update Component
```javascript
// Remove polling
- const interval = setInterval(loadData, 5000);

// Add SSE hook
+ const { data, connectionStatus } = useFirestoreSSE(
+   '/api/hub/feature/stream',
+   { communityId }
+ );
```

## Key Principles

1. **Listen only for NEW data** - Use `where('createdAt', '>', connectionTime)`
2. **Load on demand** - Comments, details, etc. only when user requests
3. **One listener per feature** - Not per user or component instance
4. **Use docChanges()** - Only process actual changes, not entire collection

## Expected Results

- **Before**: 44,000 reads/hour
- **After**: ~2,000-3,000 reads/hour
- **Savings**: 90-95% reduction in Firestore costs

## Additional Optimizations

1. **Batch reads** - Use `getAll()` for multiple documents
2. **Limit results** - Always use `.limit()` on queries
3. **Indexed queries** - Ensure all queries have indexes
4. **Cache results** - Use React state to avoid re-queries
5. **Pagination** - Load more data only when needed

## Monitoring

Track your Firestore usage at: https://console.firebase.google.com/project/[your-project]/firestore/usage

## Next Steps

1. Implement SSE endpoints for all polling components
2. Remove all `setInterval` calls
3. Use the `useFirestoreSSE` hook
4. Monitor Firestore usage for 24 hours
5. Adjust as needed