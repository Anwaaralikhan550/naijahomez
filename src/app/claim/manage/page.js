import { getSingleClaimMetadata } from '@/lib/claims/claim-preview';
import ManageAdvertClient from './ManageAdvertClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  return getSingleClaimMetadata(params?.token || '');
}

export default function ManageAdvertPage() {
  return <ManageAdvertClient />;
}
