import { getBatchClaimMetadata } from '@/lib/claims/claim-preview';
import BatchManageClient from './BatchManageClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  return getBatchClaimMetadata(params?.token || '');
}

export default function BatchManagePage() {
  return <BatchManageClient />;
}
