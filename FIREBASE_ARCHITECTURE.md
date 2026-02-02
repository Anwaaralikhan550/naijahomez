# Firebase Architecture - Admin SDK vs Client SDK

## Clear Separation of Responsibilities

### 🔧 Firebase Admin SDK (Server-side)
**File:** `src/lib/firebase-admin.js`
**Used in:** API routes (`/api/*`)

**Responsibilities:**
- ✅ Data CRUD operations (ads, properties, housemates, etc.)
- ✅ Server-side data validation
- ✅ Secure operations requiring elevated permissions
- ✅ Backend data processing

**Never used for:** Authentication (login/logout/signup)

### 🌐 Firebase Client SDK (Client-side)
**File:** `src/lib/firebase-client.js`
**Used in:** React components, contexts, hooks

**Responsibilities:**
- ✅ User authentication (`signIn`, `signOut`, `signUp`)
- ✅ Real-time auth state (`onAuthStateChanged`)
- ✅ Real-time data listeners (`onSnapshot`)
- ✅ Client-side user interactions

**Never used for:** Server-side API operations

## Data Flow

```
User Interaction → Client SDK (Auth) → User State
User Action → API Route → Admin SDK (Data) → Database
Database Changes → Client SDK (Listeners) → UI Updates
```

## Example Usage

### Authentication (Client SDK)
```javascript
// src/context/AuthContext.js
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

const signIn = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};
```

### Data Operations (Admin SDK)
```javascript
// src/app/api/ads/route.js
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET() {
  const db = getAdminFirestore();
  const ads = await db.collection('ads').get();
  return Response.json(ads.docs.map(doc => doc.data()));
}
```

## Benefits of This Architecture

1. **Security**: Admin SDK has elevated permissions for server operations
2. **Performance**: Client SDK handles real-time updates efficiently
3. **Scalability**: Clear separation allows independent scaling
4. **Maintainability**: Each SDK has specific, well-defined responsibilities
5. **Best Practices**: Follows Firebase's recommended patterns