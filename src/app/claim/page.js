import { getSingleClaimMetadata } from '@/lib/claims/claim-preview';
import ClaimClient from './ClaimClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  return getSingleClaimMetadata(params?.token || '');
}

export default function ClaimPage() {
  return <ClaimClient />;
}
